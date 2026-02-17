# libs/auth

gRPC token introspection for consumer services (not the auth service itself).

## Module Setup

```typescript
// Module imports
AuthModule.registerAsync({ useFactory: (c) => ({ url: c.AuthGrpcConfig.url }), inject: [ConfigsServiceKey] }),
// Providers
AuthModule.getGuardProvider(),         // APP_GUARD
AuthModule.getEventListenerProvider(), // Kafka SessionRevoked listener
```

## Validation Flow

Cache-first: `@Public()` check → Bearer extract → Redis cache (`auth:token:<sha256>`, 5min TTL, single-flight) → gRPC fallback.

## Decorators

- `@Public()` - Skip authentication
- `@CurrentUser()` - Inject current user from CLS

## Important

**Must import CacheModule BEFORE AuthModule** (auth depends on cache for token validation).
