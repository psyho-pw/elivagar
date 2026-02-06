import { LoggerService } from '@app/core/logger/logger.service';
import { Inject, Injectable } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { instanceToPlain } from 'class-transformer';
import { AnonymousFunction } from 'libs/core/types/anonymous-function.type';
import { CACHE_DECORATOR, CacheKeyType, CacheServiceKey } from './cache.constant';
import { CacheableQuery, CacheOptions } from './cache.interface';
import { CacheService } from './cache.service';

@Aspect(CACHE_DECORATOR)
@Injectable()
export class CacheAspect implements LazyDecorator<AnonymousFunction, CacheOptions> {
  constructor(
    @Inject(CacheServiceKey) private readonly cacheService: CacheService,
    private readonly loggerService: LoggerService,
  ) {}

  wrap({ method, metadata: options, methodName }: WrapParams<AnonymousFunction, CacheOptions>) {
    return async (...args: unknown[]): Promise<unknown> => {
      // Check condition if provided
      if (options.condition && !options.condition(...args)) {
        return method(...args);
      }

      // Build cache key
      const cacheKey = this.buildCacheKey(options, args);

      // Invalidate existing if requested
      if (options.invalidateExisting) {
        await this.cacheService.del(cacheKey);
      }

      // Single-flight pattern (coalescing)
      if (options.useSingleFlight) {
        return this.withSingleFlight(cacheKey, method, args, options, methodName);
      }

      return this.withoutSingleFlight(cacheKey, method, args, options, methodName);
    };
  }

  private async withSingleFlight(
    cacheKey: string,
    method: (...args: unknown[]) => unknown,
    args: unknown[],
    options: CacheOptions,
    methodName: string,
  ): Promise<unknown> {
    try {
      return await this.cacheService.wrap(cacheKey, async () => await method(...args), options.ttl);
    } catch (err) {
      this.loggerService.error(methodName, err, `Cache wrap failed for key: ${cacheKey}`);
      return method(...args);
    }
  }

  private async withoutSingleFlight(
    cacheKey: string,
    method: (...args: unknown[]) => unknown,
    args: unknown[],
    options: CacheOptions,
    methodName: string,
  ): Promise<unknown> {
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached !== undefined) {
      this.loggerService.verbose(methodName, `cache hit: ${cacheKey}`);
      return cached;
    }

    // Execute method
    const result = await method(...args);

    try {
      // Serialize and cache result
      const valueToCache = this.serializeValue(result);
      await this.cacheService.set(cacheKey, valueToCache, options.ttl);
      this.loggerService.verbose(methodName, `cache miss: ${cacheKey}`);
    } catch (err) {
      this.loggerService.error(methodName, err, `Cache set failed for key: ${cacheKey}`);
    }

    return result;
  }

  private buildCacheKey(options: CacheOptions, args: unknown[]): string {
    if (options.type === CacheKeyType.Plain) {
      return options.key;
    }

    if (options.type === CacheKeyType.Suffix) {
      const { key, useIdSuffix, useCacheableSuffix } = options;

      // Extract ID from argument
      const idIndex = useIdSuffix === true ? 0 : useIdSuffix ? useIdSuffix.index : undefined;
      const idPrefix = idIndex !== undefined ? this.extractIdFromArg(args[idIndex]) : '';

      // Extract suffix from CacheableQuery
      let querySuffix = '';
      if (useCacheableSuffix) {
        const cacheableArg = args.find((arg) => this.isCacheableQuery(arg));
        if (cacheableArg) {
          const payload = cacheableArg.toCachePayload();
          querySuffix = this.toSuffix(payload);
        }
      }

      const keyWithIdPrefix = idPrefix ? `${key}:${idPrefix}` : key;
      return querySuffix ? `${keyWithIdPrefix}?${querySuffix}` : keyWithIdPrefix;
    }

    throw new Error('Invalid cache option type');
  }

  private extractIdFromArg(arg: unknown): string {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number') return String(arg);
    if (typeof arg === 'object' && arg !== null && 'id' in arg) {
      return String((arg as { id: unknown }).id);
    }
    return '';
  }

  private isCacheableQuery(arg: unknown): arg is CacheableQuery {
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'toCachePayload' in arg &&
      typeof (arg as CacheableQuery).toCachePayload === 'function'
    );
  }

  private toSuffix(params: Record<string, unknown>): string {
    if (!params) return '';
    if (typeof params !== 'object') return String(params);

    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return [...value].sort();
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, normalize(v)])
            .sort(([a], [b]) => (a as string).localeCompare(b as string)),
        );
      }
      return value;
    };

    const normalized = normalize(params) as Record<string, unknown>;

    return Object.keys(normalized)
      .sort()
      .map((key) => {
        const v = normalized[key];
        return `${key}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
      })
      .join('&');
  }

  private serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    }

    if (typeof value === 'object' && value.constructor !== Object) {
      // Class instance - convert to plain object
      return instanceToPlain(value);
    }

    return value;
  }
}
