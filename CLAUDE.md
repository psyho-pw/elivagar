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

### External Connection Modules

All follow `register()` / `registerAsync({ useFactory, inject: [ConfigsServiceKey] })` pattern. See each lib's CLAUDE.md for details.

### Bootstrap Pattern

All services extend `AbstractMain` (`libs/core/src/bootstrap/abstract-main.ts`). See `libs/core/CLAUDE.md` for full 13-phase bootstrap sequence and extensibility hooks.

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
