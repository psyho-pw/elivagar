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
├── core/          # Shared core functionality (logger, config, guards, CLS)
├── grpc/          # gRPC client configuration and proto files
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

# Generate protobuf types only
pnpm proto:generate
```

### Database Migrations

MikroORM migrations require `--config.app` and `--config.env` flags:

```bash
# Create migration for a specific service
pnpm migration:create:auth
pnpm migration:create:notification
pnpm migration:create:sayho-bot

# Run migrations
pnpm migration:up:auth
pnpm migration:up:notification
pnpm migration:up:sayho-bot
pnpm migration:up:all

# Rollback migrations
pnpm migration:down:auth

# Fresh migrations (drops and recreates)
pnpm migration:fresh:auth
pnpm migration:fresh:all

# Create schema (development)
pnpm schema:create:auth
pnpm schema:create:all
```

The MikroORM CLI config (mikro-orm.config.ts) dynamically loads the correct environment file and service configuration based on CLI arguments.

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

## Key Patterns

### Entity Base Classes

All entities should extend from `libs/mikro/src/abstracts/base.entity.ts`:

- `MikroUuidEntity` - UUID primary key with timestamps
- `MikroAutoIncrementEntity` - Auto-increment integer primary key with timestamps
- `MikroUuidActorEntity` - UUID with actor tracking (extends MikroUuidEntity)
- `MikroAutoIncrementActorEntity` - Auto-increment with actor tracking

All entities include `createdAt`, `updatedAt`, and `deletedAt` (soft delete) fields.

### Configuration Loading

Configuration uses Typia for runtime validation. Each service loads environment variables through the `getEnv()` helper which:

1. Checks for service-prefixed variable (e.g., `AUTH_PORT`)
2. Falls back to non-prefixed variable (e.g., `PORT`)
3. Returns default value if neither exists

Configuration modules are in `libs/core/src/configs/configurations/`.

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

## Important Notes

- Always run `pnpm proto:generate` after modifying `.proto` files
- Each service must set `SERVICE_NAME` environment variable at runtime
- Database schemas are service-isolated; cross-service queries must use gRPC
- Use absolute imports via path aliases: `@app/core`, `@app/grpc`, `@app/mikro`
- The project uses UUIDv7 for primary keys (via `uuid` package v13)
- Environment files follow pattern `.env.{environment}` (e.g., `.env.local`)

## Docker Services

Local development containers (docker/compose.local.yml):

- PostgreSQL: localhost:5432 (user: elivagar, db: elivagar)
- Redis: localhost:6000 (mapped from container 6379)
- Redis Commander: localhost:8081 (GUI for Redis)
