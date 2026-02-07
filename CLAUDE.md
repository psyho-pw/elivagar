# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elivagar is a NestJS-based microservices monorepo built with TypeScript, featuring three independent services that communicate via gRPC. The project uses:

- **NestJS** for the framework
- **MikroORM** with PostgreSQL for database management (separate schemas per service)
- **gRPC** for inter-service communication
- **Zod** for runtime type validation
- **pnpm** for package management

## Architecture

### Monorepo Structure

The repository follows a monorepo pattern with three microservices:

```text
apps/
├── auth/          # Authentication service (port 4000, gRPC 5000)
├── notification/  # Notification service (port 4100, gRPC 5001)
└── sayho-bot/     # Sayho bot service (port 4200, gRPC 8000)

libs/
├── auth/          # Shared auth library (gRPC token introspection for consumer services)
├── cache/         # Cache module (Redis-backed with @nestjs/cache-manager)
├── core/          # Shared core functionality (logger, config, guards, CLS, lifecycle, interceptors)
├── grpc/          # gRPC client configuration and proto files
├── kafka/         # Kafka producer/consumer module with event topics
└── mikro/         # MikroORM configuration and base entities
```

### Service-Specific Configuration

Each service uses **prefixed environment variables** to avoid conflicts:

- `AUTH_*` for auth service
- `NOTIFICATION_*` for notification service
- `SAYHO_BOT_*` for sayho-bot service

The `getEnv()` helper (libs/core/src/configs/env.helper.ts) automatically resolves prefixed variables based on `SERVICE_NAME`, falling back to non-prefixed versions for shared configs (DB_*, REDIS_*, JWT_*).

### Database Architecture

- **Single PostgreSQL database** with **separate schemas per service**:
  - `auth` schema for auth service
  - `notification` schema for notification service
  - `sayho` schema for sayho-bot service (note: service name `sayho-bot` maps to schema `sayho`)

- Migrations are service-specific and stored in `libs/mikro/migrations/{service}/`
- Each service discovers entities only in its own `apps/{service}/src/**/*.entity.ts` path

### gRPC Communication

- Proto files are organized by service: `libs/grpc/src/proto/{service}/v1/{service}.proto`
- Generated TypeScript code outputs to `libs/grpc/src/proto/generated/`
- Proto generation is required before building or starting services

## Common Commands

### Development Setup

```bash
# Install dependencies
pnpm install

# Start development infrastructure (PostgreSQL, Redis)
pnpm container:up

# Stop infrastructure
pnpm container:down
```

### Running Services

Each service requires proto generation before starting:

```bash
# Start auth service in watch mode
pnpm start:auth

# Start notification service in watch mode
pnpm start:notification

# Start sayho-bot service in watch mode
pnpm start:sayho-bot
```

Services use `.env.local` file with `dotenvx` for environment management. Set `SERVICE_NAME` environment variable to control which service configuration is loaded.

### Building

```bash
# Build specific service (includes proto generation)
pnpm build:sayho-bot
pnpm build:notification
pnpm build:auth

# Generate protobuf types only
pnpm proto:generate
```

### Database Migrations

MikroORM migrations use `--app` and `--env` npm config flags:

```bash
# Create migration for a specific service
pnpm --config.env=local --config.app=auth migration:create
pnpm --config.env=local --config.app=notification migration:create
pnpm --config.env=local --config.app=sayho-bot migration:create

# Run migrations
pnpm --config.env=local --config.app=auth migration:up
pnpm --config.env=local --config.app=notification migration:up
pnpm --config.env=local --config.app=sayho-bot migration:up

# Rollback migrations
pnpm --config.env=local --config.app=auth migration:down

# Fresh migrations (drops and recreates)
pnpm --config.env=local --config.app=auth migration:fresh

# Create schema (development)
pnpm --config.env=local --config.app=auth schema:create
```

Alternatively, use the wrapper script for simpler syntax:

```bash
# Example: ./scripts/mikro-orm-cli.sh <app> <env> <command>
./scripts/mikro-orm-cli.sh auth local migration:create
./scripts/mikro-orm-cli.sh sayho-bot local migration:up
```

The MikroORM CLI config (mikro-orm.config.ts) reads `APP` and `NODE_ENV` environment variables (set via npm config flags) to determine which service configuration and environment file to load.

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run e2e tests
pnpm test:e2e

# Generate coverage
pnpm test:cov
```

Test infrastructure is in `test/`:
- `test/factories/` - Test factories (execution-context, managed-connection, user, song)
- `test/mocks/` - Module mocks (uuid, change-case) mapped via Jest `moduleNameMapper`
- `@test` path alias available for imports (e.g., `@test/factories/user.factory`)

### Code Quality

```bash
# Format code
pnpm format

# Lint and fix
pnpm lint
```

## CodeGraph

CodeGraph builds a semantic knowledge graph of codebases for faster, smarter code exploration.

### If `.codegraph/` exists in the project

**Use codegraph tools for faster exploration.** These tools provide instant lookups via the code graph instead of scanning files:

| Tool | Use For |
| ------ | --------- |
| `codegraph_search` | Find symbols by name (functions, classes, types) |
| `codegraph_context` | Get relevant code context for a task |
| `codegraph_callers` | Find what calls a function |
| `codegraph_callees` | Find what a function calls |
| `codegraph_impact` | See what's affected by changing a symbol |
| `codegraph_node` | Get details + source code for a symbol |

**When spawning Explore agents in a codegraph-enabled project:**

Tell the Explore agent to use codegraph tools for faster exploration.

**For quick lookups in the main session:**

- Use `codegraph_search` instead of grep for finding symbols
- Use `codegraph_callers`/`codegraph_callees` to trace code flow
- Use `codegraph_impact` before making changes to see what's affected

### If `.codegraph/` does NOT exist

At the start of a session, ask the user if they'd like to initialize CodeGraph:

"I notice this project doesn't have CodeGraph initialized. Would you like me to run `codegraph init -i` to build a code knowledge graph?"

## Key Patterns

### Entity Base Classes

All entities should extend from `libs/mikro/src/abstracts/base.entity.ts`:

- `MikroEntity` - Base abstract entity with timestamps and soft delete
- `MikroUuidEntity` - UUID primary key (extends MikroEntity)
- `MikroAutoIncrementEntity` - Auto-increment integer primary key (extends MikroEntity)
- `MikroUuidActorEntity` - UUID with createdBy/updatedBy actor tracking (extends MikroUuidEntity)
- `MikroAutoIncrementActorEntity` - Auto-increment with actor tracking (extends MikroAutoIncrementEntity)

All entities include `createdAt`, `updatedAt`, and `deletedAt` (soft delete) fields. The project uses UUIDv7 for primary keys via the `uuid` package. All entities have `protected constructor` - use `em.create()` instead of `new Entity()`.

### Configuration Loading

Configuration uses Zod schemas for runtime validation. Each config file defines a Zod schema (e.g., `AppConfigSchema`) with `satisfies z.ZodType<IApp>` for type safety, and validates via `safeParse` (with error logging) or `parse` (direct throw). Each service loads environment variables through the `getEnv()` helper which:

1. Checks for service-prefixed variable (e.g., `AUTH_PORT`)
2. Falls back to non-prefixed variable (e.g., `PORT`)
3. Returns default value if neither exists

**Config Files** (`libs/core/src/configs/configurations/`):

- `app.config.ts` - App settings (port, JWT, etc.)
- `database.config.ts` - PostgreSQL connection
- `redis.config.ts` - Redis connection
- `kafka.config.ts` - Kafka broker settings
- `discord.config.ts` - Discord bot settings (token, clientId, guildId, webhookUrl)
- `youtube.config.ts` - YouTube API settings (apiKey, cookie, identityToken, proxy)
- `auth-grpc.config.ts` - Auth gRPC client settings (url)

**ConfigsService (Layered Architecture)**:

The ConfigsService follows a base + extension pattern:

- **Core `ConfigsService`** (`libs/core/src/configs/configs.service.ts`) - Only core configs (`AppConfig`, `DatabaseConfig`). Uses `protected configService` to allow subclassing.
- **Service-specific `ConfigsService`** (`apps/{service}/src/configs/configs.service.ts`) - Extends core, adds service-specific getters with `getOrThrow` (non-optional return types).

```typescript
// Core ConfigsService (libs/core) - base class
@Injectable()
export class ConfigsService implements IConfigsService {
  constructor(protected readonly configService: ConfigService) {}
  get AppConfig(): IApp { ... }       // getOrThrow
  get DatabaseConfig(): IDatabase { ... } // getOrThrow
}

// Service-specific ConfigsService (apps/{service}) - extends core
import { ConfigsService as CoreConfigsService } from '@app/core/configs/configs.service';
@Injectable()
export class ConfigsService extends CoreConfigsService {
  get RedisConfig(): IRedisConfig { ... }  // getOrThrow (non-optional!)
  get KafkaConfig(): IKafkaConfig { ... }
  // ... service-specific configs
}
```

**Injection**: Always inject via `ConfigsServiceKey`. Within a service's own code, import `ConfigsService` from the local `./configs/configs.service` to get typed access to service-specific configs. For cross-cutting code in `libs/` that only needs core configs, use `IConfigsService` from `@app/core/configs/configs.interface`.

**Loading Configs per Service** (`apps/{service}/src/configs/configs.module.ts`):

```typescript
// Each service loads only the configs it needs
ConfigModule.forRoot({
  cache: true,
  load: [AppConfig, DatabaseConfig, RedisConfig, KafkaConfig, DiscordConfig],
}),
// Provides the local ConfigsService (extends core) via ConfigsServiceKey
providers: [{ provide: ConfigsServiceKey, useClass: ConfigsService }],
```

### MikroORM Module Singleton

The `MikroOrmModule.getInstance()` returns a singleton instance to ensure only one database connection per service. It automatically:

- Selects the correct schema based on `SERVICE_NAME`
- Discovers entities in the service's directory
- Configures migrations path

### CoreModule

The `CoreModule` (`libs/core/src/core.module.ts`) is a global module that provides shared infrastructure:

**Imports:**
- `LoggerModule` - Winston-based structured logging
- `LifecycleModule.forRoot()` - Connection lifecycle management
- `ClsModule` - Continuation-local storage for request context
- `AopModule` - Aspect-oriented programming support (`@toss/nestjs-aop`)

**Global Providers:**
- `RequestIdGuard` (`APP_GUARD`) - Injects CLS context with request IDs
- `ErrorInterceptor` (`APP_INTERCEPTOR`) - Catches errors, logs 500+ errors, converts to HTTP responses
- `RequestLogInterceptor` (`APP_INTERCEPTOR`) - Logs request/response with timing, flags slow requests (>10s)

### Lifecycle Management & Graceful Shutdown

The project uses a per-connection lifecycle management system in `libs/core/src/lifecycle/`:

**Core Components:**

- `LifecycleModule` - Global module providing lifecycle services (configured via `forRoot()`)
- `ConnectionRegistryService` - Registry for all external connections
- `ReadinessGateService` - Blocks API server until all connections are ready
- `GracePeriodService` - Implements `BeforeApplicationShutdown` for graceful shutdown delay
- `MikroConnectionService` - Database connection lifecycle wrapper

**IManagedConnection Interface:**
All external connection services must implement this interface:

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

**Startup Flow:**

1. All modules initialized, connection services register with `ConnectionRegistryService`
2. `app.init()` called - triggers `OnModuleInit` hooks, connections established
3. `ReadinessGateService.waitForReady()` - waits for all required connections (timeout: 30s)
4. HTTP server starts accepting requests

**Shutdown Flow (SIGTERM/SIGINT):**

1. `GracePeriodService` waits (5s default) - allows load balancer to deregister
2. Drain phase - each connection drains pending work
3. Disconnect phase - connections disconnect
4. Application exits

**Configuration (in CoreModule):**

```typescript
LifecycleModule.forRoot({
  gracePeriod: { gracePeriod: 5000 },
  readiness: { timeout: 30000, checkInterval: 1000 },
})
```

### Error Handling

**GeneralException** (`libs/core/src/common/exceptions/general.exception.ts`):

Extends `HttpException` with call context tracking for consistent error formatting:

```typescript
class GeneralException extends HttpException {
  constructor(callClass: string, callMethod: string, message: string, status?: number)
  getCalledFrom(): string  // Returns "Class.method"
}
```

### External Connection Modules

**Cache Module** (`libs/cache/`):

Redis-backed caching using `@nestjs/cache-manager` + `keyv` + `@keyv/redis`.

```typescript
// Option 1: Direct config (simpler, for standalone usage)
CacheModule.register({
  redis: RedisConfig(),
  namespace: 'my-service',
  ttl: 60000,
}),

// Option 2: Async with ConfigsService (recommended for DI)
CacheModule.registerAsync({
  useFactory: (configsService: ConfigsService) => ({
    redis: configsService.RedisConfig,
    namespace: 'my-service',
  }),
  inject: [ConfigsServiceKey],
}),
```

- `CacheService` implements `IManagedConnection` with lifecycle management
- `CacheService.getClient()` - Access raw Redis client for advanced operations (sorted sets, etc.)
- Supports single-flight pattern via `wrap()` method

**Kafka Module** (`libs/kafka/`):

```typescript
// Option 1: Direct config
KafkaModule.register({ kafka: KafkaConfig() }),

// Option 2: Async with ConfigsService
KafkaModule.registerAsync({
  useFactory: (configsService: ConfigsService) => ({
    kafka: configsService.KafkaConfig,
  }),
  inject: [ConfigsServiceKey],
}),
```

- `KafkaModule.getConsumerOptions()` - For microservice consumer setup
- Implements `IManagedConnection` with retry logic (exponential backoff) and message drain support
- `drain()` waits up to 10s for pending messages to complete before shutdown

**Kafka Event Topics** (`libs/kafka/src/events/`):

Topics follow naming convention `{service}.{entity}.{action}`:

```typescript
KafkaTopics.Auth.UserCreated        // 'auth.user.created'
KafkaTopics.Auth.SessionRevoked     // 'auth.session.revoked'
KafkaTopics.Notification.EmailSent  // 'notification.email.sent'
KafkaTopics.SayhoBot.SongPlayed     // 'sayho-bot.song.played'
```

### Auth Library (`libs/auth/`)

Shared authentication library for consumer services using gRPC token introspection:

**Module Registration:**

```typescript
// In module imports (registerAsync pattern - similar to CacheModule/KafkaModule)
AuthModule.registerAsync({
  useFactory: (configsService: ConfigsService) => ({
    url: configsService.AuthGrpcConfig.url,
  }),
  inject: [ConfigsServiceKey],
}),

// In module providers
AuthModule.getGuardProvider(),         // APP_GUARD - requires CacheModule imported first
AuthModule.getEventListenerProvider(), // AuthEventListener - requires CacheModule + KafkaModule
```

**Components:**
- `AuthGrpcClientService` - Communicates with auth service's `ValidateToken` RPC
- `AuthGuard` - Cache-first token validation: check `@Public()` → extract Bearer → Redis cache → gRPC fallback
- `AuthEventListener` - Listens for `SessionRevoked` Kafka events to invalidate cached tokens
- `@Public()` decorator - Skip auth on specific endpoints
- `@CurrentUser()` decorator - Inject authenticated user from CLS context

**Token Caching:**
- Cache key: `auth:token:<sha256_of_jwt>`, TTL 5min
- Single-flight pattern prevents thundering herd for concurrent requests with the same token

**Important:** Consumer services MUST import `CacheModule` BEFORE `AuthModule`.

### Bootstrap Pattern

All services extend `AbstractMain` from `libs/core/src/bootstrap/abstract-main.ts`:

```typescript
class MyServiceMain extends AbstractMain {
  protected getModule(): Type<unknown> {
    return MyServiceModule;
  }

  protected getBootstrapConfig(): BootstrapConfig {
    return {
      grpc: { enabled: true },
      middleware: { globalPrefix: 'api' },
      versioning: { enabled: true },
      readiness: { enabled: true, timeout: 30000 },
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
9. Wait for readiness (all connections ready via `ReadinessGateService`)
10. `onBeforeListen()` hook
11. Start microservices and HTTP server
12. `onAfterListen()` hook
13. Configure HMR (dev mode)

**Extensibility Hooks:**

- `onBeforeListen()` - Called before HTTP server starts
- `onAfterListen()` - Called after server starts (logs startup info)

### sayho-bot Discord Module (Hexagonal Architecture)

The sayho-bot's Discord integration follows hexagonal (ports & adapters) architecture:

```text
apps/sayho-bot/src/discord/
├── domain/
│   ├── entities/        # song.ts, queue-state.ts
│   └── ports/           # Interfaces: youtube-search, voice-connection, stream-provider, etc.
├── application/
│   ├── play-music.usecase.ts
│   ├── search-video.usecase.ts
│   └── queue-state.manager.ts
├── infrastructure/
│   ├── discord-client/  # Discord.js adapters (client, channel-state, player)
│   ├── voice/           # Voice connection and streaming adapters
│   └── youtube/         # YouTube search and PO token adapters
└── presentation/
    ├── commands/        # Slash command handler
    └── events/          # Message/interaction event handler
```

Uses `@toss/nestjs-aop` for cross-cutting concerns:
- `DiscordContextAspect` - Manages Discord context per request
- `DiscordErrorAspect` - Handles and formats errors

## Coding Conventions

### No Barrel Files

**Do NOT use barrel files (index.ts for re-exports).** Always use direct imports:

```typescript
// Bad - barrel import
import { AbstractMain, BootstrapConfig } from '@app/core/bootstrap';

// Good - direct import
import { AbstractMain } from '@app/core/bootstrap/abstract-main';
import { BootstrapConfig } from '@app/core/bootstrap/bootstrap.interface';
```

## Important Notes

- Always run `pnpm proto:generate` after modifying `.proto` files
- Each service must set `SERVICE_NAME` environment variable at runtime
- Database schemas are service-isolated; cross-service queries must use gRPC
- Use absolute imports via path aliases: `@app/core`, `@app/grpc`, `@app/mikro`, `@app/cache`, `@app/kafka`, `@app/auth`
- Test imports use `@test` alias (e.g., `@test/factories/user.factory`)
- The project uses UUIDv7 for primary keys (via `uuid` package v13)
- Environment files follow pattern `.env.{environment}` (e.g., `.env.local`)
- Redis/Kafka/Discord/Youtube/AuthGrpc configs are optional - only load them in services that need them

## Docker Services

Local development containers (docker/compose.local.yml):

- PostgreSQL: localhost:5432 (user: elivagar, db: elivagar)
- Redis: localhost:6000 (mapped from container 6379)
- Redis Commander: localhost:8081 (GUI for Redis)
