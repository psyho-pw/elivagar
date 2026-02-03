# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elivagar is a NestJS-based microservices monorepo built with TypeScript, featuring three independent services that communicate via gRPC. The project uses:

- **NestJS** for the framework
- **MikroORM** with PostgreSQL for database management (separate schemas per service)
- **gRPC** for inter-service communication
- **Typia** for runtime type validation and transformation
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
├── cache/         # Cache module (Redis-backed with @nestjs/cache-manager)
├── core/          # Shared core functionality (logger, config, guards, CLS, lifecycle)
├── grpc/          # gRPC client configuration and proto files
├── kafka/         # Kafka producer/consumer module
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
- `MikroUuidActorEntity` - Reserved for UUID with actor tracking (extends MikroUuidEntity)
- `MikroAutoIncrementActorEntity` - Reserved for auto-increment with actor tracking (extends MikroAutoIncrementEntity)

All entities include `createdAt`, `updatedAt`, and `deletedAt` (soft delete) fields. The project uses UUIDv7 for primary keys via the `uuid` package.

### Configuration Loading

Configuration uses Typia for runtime validation. Each service loads environment variables through the `getEnv()` helper which:

1. Checks for service-prefixed variable (e.g., `AUTH_PORT`)
2. Falls back to non-prefixed variable (e.g., `PORT`)
3. Returns default value if neither exists

**Config Files** (`libs/core/src/configs/configurations/`):

- `app.config.ts` - App settings (port, JWT, etc.)
- `database.config.ts` - PostgreSQL connection
- `redis.config.ts` - Redis connection
- `kafka.config.ts` - Kafka broker settings

**ConfigsService** (`libs/core/src/configs/configs.service.ts`):

Provides typed access to configurations via getters:

```typescript
// Inject via ConfigsServiceKey
constructor(@Inject(ConfigsServiceKey) private readonly configsService: ConfigsService) {}

// Access configs
this.configsService.AppConfig      // IApp (required)
this.configsService.DatabaseConfig // IDatabase (required)
this.configsService.RedisConfig    // IRedisConfig (optional - must be loaded)
this.configsService.KafkaConfig    // IKafkaConfig (optional - must be loaded)
```

**Loading Configs per Service** (`apps/{service}/src/configs/configs.module.ts`):

```typescript
ConfigModule.forRoot({
  cache: true,
  load: [AppConfig, DatabaseConfig, RedisConfig, KafkaConfig], // Add configs as needed
}),
```

### MikroORM Module Singleton

The `MikroOrmModule.getInstance()` returns a singleton instance to ensure only one database connection per service. It automatically:

- Selects the correct schema based on `SERVICE_NAME`
- Discovers entities in the service's directory
- Configures migrations path

### TypeScript Transformers

The project uses TypeScript transformers via `ts-patch`:

- **Typia** for runtime type validation and serialization
- **Nestia** for enhanced NestJS validation and SDK generation

These are configured in tsconfig.json plugins section.

### Lifecycle Management & Graceful Shutdown

The project uses a centralized lifecycle management system in `libs/core/src/lifecycle/`:

**Core Components:**

- `LifecycleModule` - Global module providing lifecycle services
- `ConnectionRegistryService` - Registry for all external connections
- `ReadinessGateService` - Blocks API server until all connections are ready
- `ShutdownManagerService` - Coordinates graceful shutdown on SIGTERM/SIGINT
- `MikroConnectionService` - Database connection lifecycle wrapper

**IManagedConnection Interface:**
All external connection services must implement this interface:

```typescript
interface IManagedConnection {
  readonly connectionName: string;
  readonly state: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  drain?(): Promise<void>;  // Optional: drain pending work before shutdown
}
```

**Shutdown Priority:**
Connections are shut down in priority order (higher = shutdown first):

- Kafka: priority 20 (shuts down first, drains pending messages)
- Redis: priority 10
- Database: priority 0 (shuts down last)

**Startup Flow:**

1. All modules initialized, connection services register with `ConnectionRegistryService`
2. `app.init()` called - triggers `OnModuleInit` hooks, connections established
3. `ReadinessGateService.waitForReady()` - waits for all connections (timeout: 30s)
4. HTTP server starts accepting requests

**Shutdown Flow (SIGTERM/SIGINT):**

1. Grace period (5s) - allows load balancer to deregister
2. Drain phase - each connection drains pending work
3. Close connections phase - disconnect in priority order
4. Application exits

**Configuration (in CoreModule):**

```typescript
LifecycleModule.forRoot({
  shutdown: { timeout: 30000, gracePeriod: 5000 },
  readiness: { timeout: 30000, checkInterval: 1000 },
})
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
- Implements `IManagedConnection` with retry logic and message drain support

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

**Extensibility Hooks:**

- `onBeforeListen()` - Called before HTTP server starts
- `onAfterListen()` - Called after server starts (logs startup info)

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
- Use absolute imports via path aliases: `@app/core`, `@app/grpc`, `@app/mikro`, `@app/cache`, `@app/kafka`
- The project uses UUIDv7 for primary keys (via `uuid` package v13)
- Environment files follow pattern `.env.{environment}` (e.g., `.env.local`)
- Redis/Kafka configs are optional - only load them in services that need them

## Docker Services

Local development containers (docker/compose.local.yml):

- PostgreSQL: localhost:5432 (user: elivagar, db: elivagar)
- Redis: localhost:6000 (mapped from container 6379)
- Redis Commander: localhost:8081 (GUI for Redis)
