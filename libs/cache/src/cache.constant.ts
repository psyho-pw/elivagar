// Injection tokens
export const CacheServiceKey = Symbol('CACHE_SERVICE');
export const KeyvRedisKey = Symbol('KEYV_REDIS');
export const CacheModuleOptionsKey = Symbol('CACHE_MODULE_OPTIONS');

// AOP decorator symbol
export const CACHE_DECORATOR = Symbol('CACHE_DECORATOR');

// Cache key types
export const CacheKeyType = {
  Plain: 'plain',
  Suffix: 'suffix',
} as const;

export type CacheKeyType = (typeof CacheKeyType)[keyof typeof CacheKeyType];
