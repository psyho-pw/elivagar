# Elivagar 시스템 설계 검토

> 검토일: 2026-02-06

## 종합 평가

| 영역 | 등급 | 상태 |
|------|------|------|
| **아키텍처 패턴** | ⭐⭐⭐⭐⭐ | Excellent |
| **확장성** | ⭐⭐⭐⭐ | Good (개선 필요) |
| **보안** | ⭐⭐⭐ | Adequate (갭 존재) |
| **복원력/안정성** | ⭐⭐⭐⭐⭐ | Excellent |
| **코드 품질** | ⭐⭐⭐⭐ | Good |
| **성능** | ⭐⭐⭐⭐ | Good |

### 이슈 요약

| 심각도 | 개수 | 설명 |
|--------|------|------|
| 🔴 Critical | 2 | 비밀번호 해싱, 인증 가드 |
| 🟠 High | 3 | 커넥션 풀, 쿼리 제한, DB 재시도 |
| 🟡 Medium | 11 | Rate Limiting, Health Check 등 |
| 🟢 Low | 2 | 미사용 메타데이터, 쿼리 캐싱 |
| ✅ Excellent | 8+ | Lifecycle, gRPC, 캐싱, Graceful Shutdown |

---

## 🔴 Critical Issues (즉시 수정 필요)

### 1. 비밀번호 평문 저장

**현재 코드:**
```typescript
// apps/auth/src/user/user.entity.ts
@Entity({ schema: 'auth' })
export class User extends MikroAutoIncrementEntity {
  @Property()
  password!: string; // ❌ 평문 저장!
}
```

**위험**: 데이터베이스 침해 시 모든 사용자 비밀번호 노출

**권장 수정:**
```typescript
import * as bcrypt from 'bcrypt';

@Entity({ schema: 'auth' })
export class User extends MikroAutoIncrementEntity {
  @Property()
  password!: string;

  @BeforeCreate()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }
}
```

---

### 2. 인증/인가 가드 미적용

**현재 코드:**
```typescript
// apps/auth/src/auth.controller.ts
@Controller()
export class AuthController {
  @Get() // ❌ 인증 없이 접근 가능
  getHello(): string {
    return this.authService.getHello();
  }
}
```

**위험**: 모든 엔드포인트가 공개 접근 가능

**권장 수정:**
```typescript
// libs/core/src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    try {
      request.user = this.jwtService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

// apps/auth/src/auth.controller.ts
@Controller('auth')
export class AuthController {
  @Post('login')
  @Public() // 로그인만 공개
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: User) {
    return user;
  }
}
```

---

## 🟠 High Priority Issues

### 3. DB 커넥션 풀 미설정

**현재 코드:**
```typescript
// libs/mikro/src/mikro.module.ts
const options: MikroOrmModuleOptions = {
  host, port, user, password, dbName, schema,
  // ❌ 풀 설정 없음
};
```

**위험**: 부하 시 커넥션 고갈로 서비스 장애

**권장 수정:**
```typescript
const options: MikroOrmModuleOptions = {
  host, port, user, password, dbName, schema,
  pool: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
  },
};
```

---

### 4. 쿼리 결과 제한 없음

**현재 코드:**
```typescript
// ❌ 무제한 조회 가능
const songs = await songRepository.findAll();
```

**위험**: 대량 데이터 조회 시 메모리 폭발, DB CPU 스파이크

**권장 수정:**
```typescript
// libs/mikro/src/abstracts/safe.repository.ts
export abstract class SafeEntityRepository<T extends object> extends EntityRepository<T> {
  private readonly DEFAULT_LIMIT = 100;
  private readonly MAX_LIMIT = 1000;

  async findSafe(
    where: FilterQuery<T>,
    options: { limit?: number; offset?: number } = {},
  ): Promise<T[]> {
    const limit = Math.min(options.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
    return this.find(where, { limit, offset: options.offset });
  }

  async findAllPaginated(
    where: FilterQuery<T>,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
    const safePageSize = Math.min(pageSize, this.MAX_LIMIT);
    const [data, total] = await this.findAndCount(where, {
      limit: safePageSize,
      offset: (page - 1) * safePageSize,
    });
    return { data, total, page, pageSize: safePageSize };
  }
}
```

---

### 5. DB 연결 재시도 로직 없음

**현재 코드:**
```typescript
// libs/core/src/lifecycle/mikro-connection.service.ts
async connect(): Promise<void> {
  try {
    const isConnected = await this.orm.isConnected();
    if (!isConnected) await this.orm.connect();
    // ❌ 단일 시도, 실패 시 즉시 throw
  } catch (error) {
    this._state = ConnectionState.ERROR;
    throw error;
  }
}
```

**위험**: 일시적 네트워크 문제로 서비스 시작 실패

**권장 수정:**
```typescript
async connect(): Promise<void> {
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const isConnected = await this.orm.isConnected();
      if (!isConnected) await this.orm.connect();
      this._state = ConnectionState.CONNECTED;
      this.logger.log(`Database connected on attempt ${attempt}`);
      return;
    } catch (error) {
      this.logger.warn(
        `Database connection attempt ${attempt}/${maxRetries} failed`,
        error,
      );

      if (attempt === maxRetries) {
        this._state = ConnectionState.ERROR;
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await this.sleep(delay);
    }
  }
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 🟡 Medium Priority Issues

### 6. Rate Limiting 미적용

**위험**: Brute force, DDoS 공격 취약

**권장:**
```typescript
// libs/core/src/core.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1분
      limit: 100,  // 100 요청
    }]),
  ],
})
export class CoreModule {}

// 특정 엔드포인트에 더 엄격한 제한
@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1분에 5회
  async login() { ... }
}
```

---

### 7. Health Check 엔드포인트 없음

**위험**: Kubernetes 배포 시 liveness/readiness probe 불가

**권장:**
```typescript
// libs/core/src/health/health.controller.ts
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

@Controller('health')
export class HealthController {
  constructor(
    private readonly readinessGate: ReadinessGateService,
    private readonly connectionRegistry: ConnectionRegistryService,
  ) {}

  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    const isReady = await this.connectionRegistry.areAllRequiredReady();
    if (!isReady) {
      throw new ServiceUnavailableException('Service not ready');
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get()
  async health() {
    const connections = await this.connectionRegistry.getConnectionsHealth();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections,
    };
  }
}
```

---

### 8. Circuit Breaker 패턴 없음

**위험**: 외부 서비스 장애 시 전체 시스템으로 장애 전파

**권장:**
```typescript
// libs/core/src/resilience/circuit-breaker.service.ts
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private breakers = new Map<string, CircuitBreaker>();

  create<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    options?: CircuitBreaker.Options,
  ): CircuitBreaker<T> {
    const breaker = new CircuitBreaker(fn, {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...options,
    });

    breaker.on('open', () => this.logger.warn(`Circuit ${name} opened`));
    breaker.on('halfOpen', () => this.logger.log(`Circuit ${name} half-open`));
    breaker.on('close', () => this.logger.log(`Circuit ${name} closed`));

    this.breakers.set(name, breaker);
    return breaker;
  }
}
```

---

### 9. Redis 클러스터/센티널 미지원

**현재 코드:**
```typescript
// libs/core/src/configs/configurations/redis.config.ts
// ❌ 단일 노드만 지원
return `redis://:${password}@${host}:${port}/${dbPath}`;
```

**권장:**
```typescript
export interface IRedisConfig {
  mode: 'standalone' | 'cluster' | 'sentinel';
  // Standalone
  host?: string;
  port?: number;
  // Cluster/Sentinel
  nodes?: Array<{ host: string; port: number }>;
  sentinelName?: string;
  // Common
  password?: string;
  db?: number;
}
```

---

### 10. 로그에 민감정보 노출 가능

**현재 코드:**
```typescript
// libs/core/src/logger/logger.service.ts
if (typeof obj === 'object' && obj !== null) {
  log.data = obj; // ❌ 비밀번호, 토큰 등 노출 가능
}
```

**권장:**
```typescript
private readonly SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'apiKey', 'jwt',
  'authorization', 'cookie', 'credential',
];

private maskSensitiveData(obj: any, depth = 0): any {
  if (depth > 10 || obj === null || obj === undefined) return obj;

  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveData(item, depth + 1));
    }

    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (this.SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
          return [key, '***MASKED***'];
        }
        return [key, this.maskSensitiveData(value, depth + 1)];
      }),
    );
  }

  return obj;
}
```

---

### 11. Kafka Consumer 미구현

**현재 상태**: Producer만 구현됨, 이벤트 수신 불가

**권장:**
```typescript
// apps/sayho-bot/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(SayhoBotModule);

  // Kafka Consumer 마이크로서비스 연결
  app.connectMicroservice<MicroserviceOptions>(
    KafkaModule.getConsumerOptions({
      kafka: configsService.KafkaConfig,
      consumer: { groupId: 'sayho-bot-group' },
    }),
  );

  await app.startAllMicroservices();
  await app.listen(port);
}

// Event Handler
@Controller()
export class EventsController {
  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: UserCreatedEvent) {
    // 이벤트 처리
  }
}
```

---

### 12. 쿼리 캐싱 전략 없음

**권장:**
```typescript
// libs/core/src/common/decorators/cacheable.decorator.ts
export function Cacheable(options: { key: string; ttl?: number }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = this.cacheService as CacheService;
      const cacheKey = `${options.key}:${JSON.stringify(args)}`;

      return cacheService.wrap(
        cacheKey,
        () => originalMethod.apply(this, args),
        options.ttl,
      );
    };

    return descriptor;
  };
}

// 사용 예시
@Injectable()
export class SongService {
  @Cacheable({ key: 'song', ttl: 60000 })
  async findById(id: string): Promise<Song> {
    return this.songRepository.findOne(id);
  }
}
```

---

## ✅ 잘 구현된 패턴

### 1. Lifecycle Management (완벽)

```
Startup Sequence:
1. ConfigModule 로드 및 환경 변수 검증
2. CoreModule 초기화 (Logger, Lifecycle, CLS, MikroORM)
3. GrpcModule 등록
4. 서비스별 모듈 import
5. app.init() - OnModuleInit 훅 트리거
6. ConnectionRegistryService에 연결 등록
7. ReadinessGateService.waitForReady() - 모든 연결 대기 (30초 타임아웃)
8. gRPC 마이크로서비스 시작
9. HTTP 서버 리스닝 시작

Shutdown Sequence:
1. Grace Period (5초) - 로드밸런서 등록 해제 대기
2. Drain Phase - 각 연결별 대기 작업 처리
3. Close Phase - 우선순위 순서로 연결 종료
   - Kafka (priority: 20) - 가장 먼저
   - Redis (priority: 10)
   - Database (priority: 0) - 가장 마지막
4. 애플리케이션 종료
```

---

### 2. Single-Flight Caching (우수)

```typescript
// libs/cache/src/cache.service.ts
async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
  // 동시 요청 병합 → Thundering Herd 방지
  const inflight = this.inflightRequests.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = (async () => {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  })();

  this.inflightRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    this.inflightRequests.delete(key);
  }
}
```

---

### 3. Service-Prefixed Configuration (우수)

```typescript
// libs/core/src/configs/configs.helper.ts
export function getEnv(key: string, defaultValue?: string): string {
  const prefix = getServicePrefix(); // AUTH_, NOTIFICATION_, SAYHO_BOT_

  // 1. 서비스 접두사 변수 확인
  const prefixedValue = process.env[`${prefix}${key}`];
  if (prefixedValue !== undefined) return prefixedValue;

  // 2. 공통 변수 fallback
  return process.env[key] || defaultValue || '';
}
```

**장점**:
- 같은 머신에서 여러 서비스 실행 가능
- 환경 변수 충돌 방지
- 공통 설정은 fallback으로 공유

---

### 4. gRPC 최적화 (우수)

```typescript
// libs/grpc/src/grpc/grpc.service.ts
const opt: GrpcOptions = {
  options: {
    maxSendMessageLength: 1024 * 1024 * 10,    // 10MB
    maxReceiveMessageLength: 1024 * 1024 * 10, // 10MB
    keepalive: {
      keepaliveTimeMs: 30000,      // 30초 간격
      keepaliveTimeoutMs: 20000,   // 20초 타임아웃
      keepalivePermitWithoutCalls: 1,
    },
  },
};
```

---

### 5. Abstract Bootstrap Pattern (우수)

```typescript
// libs/core/src/bootstrap/abstract-main.ts
export abstract class AbstractMain {
  protected abstract getModule(): Type<unknown>;
  protected abstract getBootstrapConfig(): BootstrapConfig;

  // Template Method Pattern
  async bootstrap(): Promise<void> {
    await this.createApplication();
    await this.configureMiddleware();
    await this.configureGrpc();
    await this.onBeforeListen();
    await this.startServer();
    await this.onAfterListen();
  }

  // Hook methods for customization
  protected async onBeforeListen(): Promise<void> {}
  protected async onAfterListen(): Promise<void> {}
}
```

---

### 6. IManagedConnection Interface (우수)

```typescript
// libs/core/src/lifecycle/lifecycle.interface.ts
export interface IManagedConnection {
  readonly connectionName: string;
  readonly state: ConnectionState;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  drain?(): Promise<void>; // Optional: 대기 작업 처리
}

// 구현체: CacheService, KafkaService, MikroConnectionService
```

---

### 7. Request Context with CLS (우수)

```typescript
// libs/core/src/common/guards/cls.guard.ts
@Injectable()
export class RequestIdGuard implements CanActivate {
  constructor(private readonly clsService: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || v7();
    this.clsService.requestId = requestId;
    return true;
  }
}
```

---

## 권장 구현 로드맵

### Phase 1: 보안 (즉시)

- [ ] bcrypt 비밀번호 해싱
- [ ] JWT 인증 가드 적용
- [ ] 로그 민감정보 마스킹
- [ ] Rate Limiting 추가

### Phase 2: 안정성 (1주)

- [ ] DB 커넥션 재시도 로직
- [ ] Circuit Breaker 패턴
- [ ] Health/Ready 엔드포인트
- [ ] 쿼리 페이지네이션

### Phase 3: 확장성 (2주)

- [ ] DB 커넥션 풀 설정
- [ ] Redis 클러스터 지원
- [ ] Kafka Consumer 구현
- [ ] 쿼리 캐싱 데코레이터

### Phase 4: 관측성 (지속)

- [ ] 통합 테스트 추가
- [ ] 분산 추적 (Jaeger/Tempo)
- [ ] 메트릭 수집 (Prometheus)
- [ ] 운영 런북 작성

---

## 결론

Elivagar는 **우수한 기반 아키텍처**를 갖추고 있으며, 특히 Lifecycle Management와 Connection 관리 패턴이 프로덕션 수준입니다.

다만 **보안 강화**와 **비즈니스 로직 구현**이 프로덕션 배포 전 필수적으로 완료되어야 합니다. Critical 이슈 2건(비밀번호 해싱, 인증 가드)은 즉시 수정이 필요합니다.
