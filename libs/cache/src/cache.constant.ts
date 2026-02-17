import { Union } from '@app/core/types/union.type';

// Injection tokens
export const CacheServiceKey = Symbol('CacheServiceKey');
export const KeyvRedisKey = Symbol('KeyvRedisKey');
export const CacheModuleOptionsKey = Symbol('CacheModuleOptionsKey');

// AOP decorator symbol
export const CACHE_DECORATOR = Symbol('CacheDecorator');

// Cache key types
export const CacheKeyType = {
  Plain: 'plain',
  Suffix: 'suffix',
} as const;

export type CacheKeyType = Union<typeof CacheKeyType>;
