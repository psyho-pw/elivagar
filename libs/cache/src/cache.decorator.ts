import { createDecorator } from '@toss/nestjs-aop';
import { CACHE_DECORATOR } from './cache.constant';
import { CacheOptions } from './cache.interface';

/**
 * Cache decorator for AOP-based method caching
 *
 * @param options.key - Cache key (prefix) required
 * @param options.type - Cache key generation type (Plain | Suffix) required
 * @param options.ttl - Cache expiration time in milliseconds
 * @param options.invalidateExisting - If true, invalidate existing cache before execution (default: false)
 * @param options.condition - Condition function to determine if caching should apply (default: undefined)
 * @param options.useSingleFlight - Enable single-flight pattern to prevent thundering herd (default: false)
 * @param options.useIdSuffix - Extract id from method argument as suffix (true = index 0, { index: N } for specific index)
 * @param options.useCacheableSuffix - Use CacheableQuery.toCachePayload() for suffix generation
 */
export const Cache = (options: CacheOptions): MethodDecorator =>
  createDecorator(CACHE_DECORATOR, options);
