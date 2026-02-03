import KeyvRedis from '@keyv/redis';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AopModule } from '@toss/nestjs-aop';
import { Keyv } from 'keyv';
import { CacheAspect } from './cache.aspect';
import { CacheModuleOptionsKey, CacheServiceKey, KeyvRedisKey } from './cache.constant';
import { CacheModuleAsyncOptions, CacheModuleOptions } from './cache.interface';
import { CacheService } from './cache.service';

@Module({})
export class CacheModule {
  private static buildRedisUrl(host: string, port: number, password?: string, db?: number): string {
    const dbPath = db ?? 0;
    return password
      ? `redis://:${password}@${host}:${port}/${dbPath}`
      : `redis://${host}:${port}/${dbPath}`;
  }

  /**
   * Register Cache module with lifecycle management
   *
   * @param options.redis - Redis connection configuration (required)
   * @param options.providerToken - Custom provider token for multi-instance scenarios
   * @param options.namespace - Key prefix namespace
   * @param options.ttl - Default TTL in milliseconds
   */
  static register(options: CacheModuleOptions): DynamicModule {
    const { redis } = options;
    const serviceToken = options.providerToken ?? CacheServiceKey;
    const redisUrl = this.buildRedisUrl(redis.host, redis.port, redis.password, redis.db);
    const namespace = options.namespace ?? redis.keyPrefix;
    const ttl = options.ttl ?? 60000; // default 1 minute

    const keyvRedisProvider: Provider = {
      provide: KeyvRedisKey,
      useFactory: (): KeyvRedis<string> => {
        return new KeyvRedis<string>(redisUrl, { useUnlink: true });
      },
    };

    const cacheServiceProvider: Provider = {
      provide: serviceToken,
      useClass: CacheService,
    };

    return {
      module: CacheModule,
      imports: [
        AopModule,
        NestCacheModule.registerAsync({
          extraProviders: [keyvRedisProvider],
          useFactory: (keyvRedis: KeyvRedis<string>) => {
            const keyv = new Keyv({ store: keyvRedis, namespace, ttl });
            return { stores: [keyv] };
          },
          inject: [KeyvRedisKey],
        }),
      ],
      providers: [keyvRedisProvider, cacheServiceProvider, CacheAspect],
      exports: [serviceToken, KeyvRedisKey, NestCacheModule],
    };
  }

  /**
   * Register Cache module asynchronously with dependency injection
   *
   * @param asyncOptions.imports - Modules to import (e.g., ConfigModule)
   * @param asyncOptions.useFactory - Factory function returning CacheModuleOptions
   * @param asyncOptions.inject - Dependencies to inject into factory
   */
  static registerAsync(asyncOptions: CacheModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: CacheModuleOptionsKey,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject ?? [],
    };

    const keyvRedisProvider: Provider = {
      provide: KeyvRedisKey,
      useFactory: (options: CacheModuleOptions): KeyvRedis<string> => {
        const { redis } = options;
        const redisUrl = this.buildRedisUrl(redis.host, redis.port, redis.password, redis.db);
        return new KeyvRedis<string>(redisUrl, { useUnlink: true });
      },
      inject: [CacheModuleOptionsKey],
    };

    const cacheServiceProvider: Provider = {
      provide: CacheServiceKey,
      useClass: CacheService,
    };

    return {
      module: CacheModule,
      imports: [
        ...(asyncOptions.imports ?? []),
        AopModule,
        NestCacheModule.registerAsync({
          extraProviders: [optionsProvider, keyvRedisProvider],
          useFactory: (options: CacheModuleOptions, keyvRedis: KeyvRedis<string>) => {
            const { redis } = options;
            const namespace = options.namespace ?? redis.keyPrefix;
            const ttl = options.ttl ?? 60000;
            const keyv = new Keyv({ store: keyvRedis, namespace, ttl });
            return { stores: [keyv] };
          },
          inject: [CacheModuleOptionsKey, KeyvRedisKey],
        }),
      ],
      providers: [optionsProvider, keyvRedisProvider, cacheServiceProvider, CacheAspect],
      exports: [CacheServiceKey, KeyvRedisKey, NestCacheModule],
    };
  }
}
