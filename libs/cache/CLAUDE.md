# libs/cache

Redis-backed cache via keyv. `CacheService` implements `IManagedConnection`. `getClient()` for raw Redis.

## Registration

```typescript
CacheModule.registerAsync({
  useFactory: (c) => ({ url: c.RedisConfig.url }),
  inject: [ConfigsServiceKey],
})
```

## AOP `@Cache()` Decorator

```typescript
@Cache({
  key: 'my-cache-key',
  type: CacheKeyType.Suffix,     // 'plain' | 'suffix'
  ttl: 60000,
  useSingleFlight: true,
  useIdSuffix: true,              // ID from first argument
  useCacheableSuffix: true,       // CacheableQuery.toCachePayload()
  condition: (...args) => true,   // Skip caching conditionally
  invalidateExisting: false,
})
```
