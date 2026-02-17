# libs/core

## CoreModule (`libs/core/src/core.module.ts`)

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

## Lifecycle Management (`libs/core/src/lifecycle/`)

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

## Error & Response Handling

**GeneralException** (`libs/core/src/common/exceptions/general.exception.ts`): Extends `HttpException` with call context.

```typescript
constructor(dto: { callClass: string; callMethod: string; message: string; status?: number; originalError?: Error })
```

**Exception Filters** (`libs/core/src/common/filters/`): `AbstractExceptionFilter` → `GeneralExceptionFilter` (HTTP only; re-throws for gRPC/Kafka). `ErrorResponse`: `{ statusCode, message, path, error, callClass?, callMethod?, stack? }`.

**ApiResponse** (`libs/core/src/common/response/api-response.ts`): Wraps HTTP responses (`statusCode`, `message`, `data`). Applied by `ResponseInterceptor` (HTTP only, skips gRPC/Kafka). Bypass with `@BypassResponseInterceptor()`.

## Bootstrap Pattern

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
