# CLAUDE.md

## Project Overview

Elivagar is a NestJS-based microservices monorepo (TypeScript) with three services communicating via gRPC. Stack: NestJS, MikroORM + PostgreSQL, gRPC, Zod, pnpm.

## Architecture

### Monorepo Structure

```text
apps/
├── auth/          # Authentication (port 4000, gRPC 5000)
├── notification/  # Notification (port 4100, gRPC 5001)
└── sayho-bot/     # Sayho bot (port 4200, gRPC 8000)

libs/
├── auth/    # Shared auth (gRPC token introspection for consumers)
├── cache/   # Redis-backed cache (@nestjs/cache-manager)
├── core/    # Shared: logger, config, guards, CLS, lifecycle, interceptors
├── grpc/    # gRPC client config and proto files
├── kafka/   # Kafka producer/consumer with event topics
└── mikro/   # MikroORM config and base entities
```

### Service Configuration

Each service uses prefixed env vars (`AUTH_*`, `NOTIFICATION_*`, `SAYHO_BOT_*`). The `getEnv()` helper (`libs/core/src/configs/configs.helper.ts`) resolves prefixed → non-prefixed → default. Also: `getEnvInt()`, `getEnvBool()`.

### Database

Single PostgreSQL DB with separate schemas: `auth`, `notification`, `sayho` (note: `sayho-bot` → schema `sayho`). Migrations in `libs/mikro/migrations/{service}/`. Entities discovered in `apps/{service}/src/**/*.entity.ts`.

### gRPC

Proto files: `libs/grpc/src/proto/{service}/v1/{service}.proto`. Generated output: `libs/grpc/src/proto/generated/`. Always run `pnpm proto:generate` after modifying `.proto` files.

## Common Commands

```bash
pnpm install                    # Install deps
pnpm container:up / :down       # Start/stop infra (PostgreSQL, Redis, Kafka)
pnpm start:auth                 # Start service in watch mode (also: start:notification, start:sayho-bot)
pnpm build:auth                 # Build (includes proto gen; also: build:notification, build:sayho-bot)
pnpm proto:generate             # Generate protobuf types only
pnpm test / test:watch / test:e2e / test:cov
pnpm format / lint
```

### Database Migrations

```bash
pnpm --config.env=local --config.app=auth migration:create  # Also: migration:up, migration:down, migration:fresh, schema:create
# Or wrapper: ./scripts/mikro-orm-cli.sh auth local migration:create
```

### Test Infrastructure

- `test/factories/` - Factories (execution-context, managed-connection, user, song, notification). `createMockExecutionContext` supports `type` (`'http'|'rpc'|'ws'`), `rpcContext`, `rpcData`
- `test/mocks/` - Module mocks (uuid, change-case, mikro-orm-core) via Jest `moduleNameMapper`. `mikro-orm-core` mock stubs `@Transactional()` as no-op
- `@test` path alias for imports

## CodeGraph

If `.codegraph/` exists, use codegraph tools (`codegraph_search`, `codegraph_context`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`) for faster exploration. If not, ask user to run `codegraph init -i`.

## Key Patterns

### Entity Base Classes (`libs/mikro/src/abstracts/base.entity.ts`)

Hierarchy: `MikroEntity` → `MikroUuidEntity` / `MikroAutoIncrementEntity` → `MikroUuidActorEntity` / `MikroAutoIncrementActorEntity`

- All include `createdAt`, `updatedAt`, `deletedAt` (soft delete). UUIDv7 via `uuid` package.
- `protected constructor` on base; concrete entities: `constructor(data?: Partial<Entity>)`. Use `em.create()` or `repository.create()`.
- Entity → Repository binding: `@Entity({ repository: () => XxxRepository })`

### ConfigsService (Layered Architecture)

Base + extension pattern. Core `ConfigsService` (`libs/core`) has `AppConfig`, `DatabaseConfig` with `protected configService` for subclassing. Service-specific (`apps/{service}/src/configs/configs.service.ts`) extends core, adds getters with `getOrThrow`.

```typescript
// Core (libs/core/src/configs/configs.service.ts)
@Injectable()
export class ConfigsService implements IConfigsService {
  constructor(protected readonly configService: ConfigService) {}
  get AppConfig(): IApp { ... }
  get DatabaseConfig(): IDatabase { ... }
}

// Service-specific (apps/{service}/src/configs/configs.service.ts)
import { ConfigsService as CoreConfigsService } from '@app/core/configs/configs.service';
@Injectable()
export class ConfigsService extends CoreConfigsService {
  get RedisConfig(): IRedisConfig { ... }
  get KafkaConfig(): IKafkaConfig { ... }
}
```

**Injection**: Always via `ConfigsServiceKey`. Within service code, import from local `./configs/configs.service`. In `libs/`, use `IConfigsService` from `@app/core/configs/configs.interface`.

Config files in `libs/core/src/configs/configurations/`: app, database, redis, kafka, discord, discord-webhook, youtube, auth-grpc. Each uses Zod schema validation (`safeParse`/`parse`).

### MikroORM

- `MikroOrmModule.getInstance()` - Singleton per service, auto-selects schema by `SERVICE_NAME`
- `MikroOrmContextInterceptor` as `APP_INTERCEPTOR` for request context (supports HTTP, gRPC, Kafka)
- Custom `EntityRepository` per entity; `@Transactional()` for transactions

### CoreModule (`libs/core/src/core.module.ts`)

Global module. Imports: LoggerModule, LifecycleModule, ClsModule, AopModule (`@toss/nestjs-aop`).

Global providers:

- `RequestIdGuard` (APP_GUARD) - Transport-agnostic CLS init. Sets `requestId`, `controllerCtx`, `methodCtx` on CLS store:
  - HTTP: `x-request-id` from headers, sets `request.requestId`/`request.startTime`
  - gRPC: `x-request-id` from `Metadata` (via `instanceof Metadata`)
  - Kafka: `x-request-id` from message headers (string/Buffer, via `getTopic()` duck-typing)
  - Fallback: new UUIDv7
- `GeneralExceptionFilter` (APP_FILTER) - Formats `ErrorResponse`, logs 500+, strips debug in prod
- `RequestLogInterceptor` (APP_INTERCEPTOR) - Logs with timing, flags >10s
- `ClassSerializerInterceptor` + `ResponseInterceptor` - Serialization + `ApiResponse` wrapping

CLS configured with `middleware: { mount: true }, guard: { mount: true }`.

### Lifecycle Management (`libs/core/src/lifecycle/`)

**IManagedConnection Interface** - All external connection services must implement:

```typescript
interface IManagedConnection {
  readonly connectionName: string;
  readonly state: ConnectionState;  // DISCONNECTED | CONNECTING | CONNECTED | DISCONNECTING | ERROR
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  drain?(): Promise<void>;  // Optional: drain pending work before shutdown
}
```

**Components**: `ConnectionRegistryService` (registry), `ReadinessGateService` (blocks until ready), `GracePeriodService` (shutdown delay), `MikroConnectionService` (DB lifecycle).

**Startup Flow:**

1. All modules initialized, connection services register with `ConnectionRegistryService`
2. `app.init()` - triggers `OnModuleInit` hooks, connections established
3. `ReadinessGateService.waitForReady()` - waits for all connections (timeout: 30s)
4. HTTP server starts accepting requests

**Shutdown Flow (SIGTERM/SIGINT):**

1. `GracePeriodService` waits (0 non-prod, 5s prod for LB deregistration)
2. Drain phase - each connection drains pending work
3. Disconnect phase - connections disconnect
4. Application exits

**Configuration:**

```typescript
LifecycleModule.forRoot({
  gracePeriod: { gracePeriod: process.env.NODE_ENV !== Env.production ? 0 : 5000 },
  readiness: { timeout: 30000, checkInterval: 1000 },
})
```

### Error & Response Handling

**GeneralException** (`libs/core/src/common/exceptions/general.exception.ts`): Extends `HttpException` with call context.

```typescript
constructor(dto: { callClass: string; callMethod: string; message: string; status?: number; originalError?: Error })
```

**Exception Filters** (`libs/core/src/common/filters/`): `AbstractExceptionFilter` → `GeneralExceptionFilter` (HTTP only; re-throws for gRPC/Kafka). `ErrorResponse`: `{ statusCode, message, path, error, callClass?, callMethod?, stack? }`.

**ApiResponse** (`libs/core/src/common/response/api-response.ts`): Wraps HTTP responses (`statusCode`, `message`, `data`). Applied by `ResponseInterceptor` (HTTP only, skips gRPC/Kafka). Bypass with `@BypassResponseInterceptor()`.

### External Connection Modules

All follow `register()` / `registerAsync({ useFactory, inject: [ConfigsServiceKey] })` pattern.

**Cache** (`libs/cache/`): Redis via keyv. `CacheService` implements `IManagedConnection`. `getClient()` for raw Redis. AOP `@Cache()` decorator:

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

**Kafka** (`libs/kafka/`): `getConsumerOptions()`, `getExceptionFilterProvider()`. `IManagedConnection` with retry + drain (10s). Auto-propagates `x-request-id` via CLS. Topics: `{service}.{entity}.{action}` convention, constants in `KafkaTopics.{Service}.{Event}`.

**Auth** (`libs/auth/`): gRPC token introspection for consumer services.

```typescript
// Module imports
AuthModule.registerAsync({ useFactory: (c) => ({ url: c.AuthGrpcConfig.url }), inject: [ConfigsServiceKey] }),
// Providers
AuthModule.getGuardProvider(),         // APP_GUARD
AuthModule.getEventListenerProvider(), // Kafka SessionRevoked listener
```

Cache-first validation: `@Public()` check → Bearer extract → Redis cache (`auth:token:<sha256>`, 5min TTL, single-flight) → gRPC fallback. Decorators: `@Public()`, `@CurrentUser()`. **Must import CacheModule BEFORE AuthModule.**

### Bootstrap Pattern

All services extend `AbstractMain` (`libs/core/src/bootstrap/abstract-main.ts`):

```typescript
class MyServiceMain extends AbstractMain {
  protected getModule() { return MyServiceModule; }
  protected getBootstrapConfig(): BootstrapConfig {
    return {
      options: { bufferLogs: true, enableShutdownHooks: true },
      grpc: { enabled: true },
      middleware: { globalPrefix: 'api' },
      versioning: { enabled: true },
    };
  }
}
MyServiceMain.run();
```

**Bootstrap Phases (Template Method):**

1. Create NestJS application (buffer logs)
2. Resolve core services (ConfigsService, LoggerService)
3. Log startup info with mapped env variables
4. Configure middleware (trust proxy, helmet, CORS)
5. Configure API versioning (URI, default v1)
6. Setup Winston logger (disabled in local env)
7. Configure gRPC microservice
8. `app.init()` - triggers `OnModuleInit` hooks
9. Wait for readiness (all connections via `ReadinessGateService`)
10. `onBeforeListen()` hook
11. Start microservices and HTTP server
12. `onAfterListen()` hook (logs startup info)
13. Configure HMR (dev mode)

**Extensibility Hooks**: `onBeforeListen()`, `onAfterListen()`. Notification overrides `onBeforeListen()` to connect Kafka consumer.

### sayho-bot Discord (Hexagonal Architecture)

```text
apps/sayho-bot/src/discord/
├── domain/          # entities (song, queue-state), ports (interfaces)
├── application/     # use cases (play-music, search-video, leave-channel, manage-queue, handle-voice-state)
├── infrastructure/  # adapters: discord-client, voice, youtube
└── presentation/    # commands, events, helpers
```

AOP cross-cutting: `DiscordContextAspect`, `DiscordErrorAspect`.

## Coding Conventions

- **No barrel files** - Always direct imports: `import { X } from '@app/core/bootstrap/abstract-main'` (not `'@app/core/bootstrap'`)
- **No TypeScript `enum`** - Use `as const` + `Union<T>` (`libs/core/src/types/union.type.ts`). Never use `(typeof X)[keyof typeof X]`
- **`.constant.ts`** for `as const` + type pairs, injection tokens (Symbols), type guards. **`.interface.ts`** for pure types only
- **Symbol naming** - PascalCase descriptions matching variable: `Symbol('CacheServiceKey')` not `Symbol('CACHE_SERVICE')`

```typescript
// as const + Union pattern (in .constant.ts)
import { Union } from '@app/core/types/union.type';
export const NotificationType = { SYSTEM: 'SYSTEM', AUTH: 'AUTH', INFO: 'INFO' } as const;
export type NotificationType = Union<typeof NotificationType>;
```

## Important Notes

- Path aliases: `@app/core`, `@app/grpc`, `@app/mikro`, `@app/cache`, `@app/kafka`, `@app/auth`, `@test`
- UUIDv7 for primary keys (`uuid` v13). Env files: `.env.{environment}`
- Redis/Kafka/Discord/Youtube/AuthGrpc configs are optional per service
- `SERVICE_NAME` env var required at runtime

## Docker Services (docker/compose.local.yml)

PostgreSQL(:5432), Redis(:6000), RedisInsight(:5540), Kafka(:9092), Kafka UI(:8082)
