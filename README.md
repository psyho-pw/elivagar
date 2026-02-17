# Elivagar

NestJS 기반 마이크로서비스 모노레포 프로젝트입니다. 세 개의 독립적인 서비스가 gRPC로 통신하며, MikroORM + PostgreSQL로 데이터를 관리합니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| 언어 | TypeScript 5.9 (native preview) |
| ORM | MikroORM 6 + PostgreSQL 16 |
| 서비스 간 통신 | gRPC (proto3) |
| 메시지 브로커 | Kafka (KafkaJS) |
| 캐싱 | Redis 7 (cache-manager + Keyv) |
| 유효성 검증 | Zod 4 |
| 패키지 매니저 | pnpm |
| 테스트 | Jest 30 + Suites |
| 로깅 | Winston |

## 아키텍처

### 모노레포 구조

```text
apps/
├── auth/              # 인증 서비스 (HTTP 4000, gRPC 5000)
├── notification/      # 알림 서비스 (HTTP 4100, gRPC 5001)
└── sayho-bot/         # Discord 봇 서비스 (HTTP 4200, gRPC 8000)

libs/
├── core/              # 공통 인프라 (로거, 설정, 가드, CLS, 생명주기 관리, 인터셉터)
├── auth/              # 인증 라이브러리 (gRPC 토큰 검증 - 소비자 서비스용)
├── grpc/              # gRPC 클라이언트 설정 및 proto 파일
├── mikro/             # MikroORM 설정 및 베이스 엔티티
├── cache/             # 캐시 모듈 (Redis 기반, @nestjs/cache-manager)
└── kafka/             # Kafka 프로듀서/컨슈머 모듈
```

### 서비스 개요

**Auth** - JWT 기반 인증/인가, 사용자 관리, 토큰 발급 및 검증 (gRPC `ValidateToken` RPC 제공)

**Notification** - Discord 웹훅 알림, Kafka 이벤트 기반 알림 처리, 알림 CRUD

**Sayho Bot** - Discord 음악 봇. 헥사고날 아키텍처로 설계되어 YouTube 검색, 음성 채널 연결, 음악 재생/대기열 관리 기능 제공

### 데이터베이스 구조

단일 PostgreSQL 인스턴스에서 서비스별 스키마를 분리하여 사용합니다.

| 서비스 | 스키마 | 마이그레이션 경로 |
|--------|--------|-------------------|
| auth | `auth` | `libs/mikro/migrations/auth/` |
| notification | `notification` | `libs/mikro/migrations/notification/` |
| sayho-bot | `sayho` | `libs/mikro/migrations/sayho-bot/` |

## 시작하기

### 사전 요구사항

- Node.js 24+
- pnpm 10+
- Docker & Docker Compose
- Protocol Buffers 컴파일러 (`protoc`)

```bash
# macOS
brew install protobuf

# Ubuntu/Debian
sudo apt-get install -y protobuf-compiler
```

### 설치

```bash
# 의존성 설치
pnpm install

# 로컬 인프라 실행 (PostgreSQL, Redis, Kafka)
pnpm container:up

# 데이터베이스 마이그레이션 실행 (기본 env: local)
pnpm migration:up:all
```

### 환경변수 설정

`.env.local` 파일을 프로젝트 루트에 생성합니다. 각 서비스는 `SERVICE_NAME` 환경변수로 구분되며, `dotenvx`를 통해 로드됩니다.

서비스별 접두사로 환경변수 충돌을 방지합니다:
- `AUTH_*` - auth 서비스
- `NOTIFICATION_*` - notification 서비스
- `SAYHO_BOT_*` - sayho-bot 서비스

### 서비스 실행

```bash
# 각 서비스 개별 실행 (watch 모드)
pnpm start:auth
pnpm start:notification
pnpm start:sayho-bot
```

## 로컬 개발 인프라

`pnpm container:up` 명령으로 아래 컨테이너가 실행됩니다.

| 서비스 | 이미지 | 포트 | 용도 |
|--------|--------|------|------|
| PostgreSQL | postgres:16-alpine | 5432 | 데이터베이스 |
| Redis | redis:7-alpine | 6000 | 캐시 |
| RedisInsight | redis/redisinsight | 5540 | Redis GUI |
| Kafka | apache/kafka:3.9.0 | 9092 | 메시지 브로커 |
| Kafka UI | provectuslabs/kafka-ui | 8082 | Kafka GUI |

```bash
# 인프라 중지
pnpm container:down
```

## 주요 명령어

### 빌드

```bash
# 서비스별 빌드 (proto 생성 자동 포함)
pnpm build:auth
pnpm build:notification
pnpm build:sayho-bot

# proto 타입만 생성
pnpm proto:generate
```

### 데이터베이스 마이그레이션

```bash
# 마이그레이션 생성
pnpm --config.env=local --config.app=auth migration:create

# 마이그레이션 실행
pnpm --config.env=local --config.app=auth migration:up

# 마이그레이션 롤백
pnpm --config.env=local --config.app=auth migration:down

# 전체 재생성 (개발용)
pnpm --config.env=local --config.app=auth migration:fresh

# 전체 서비스 마이그레이션 한번에 실행 (기본 env: local)
pnpm migration:up:all
```

래퍼 스크립트로도 실행 가능합니다:

```bash
./scripts/mikro-orm-cli.sh auth local migration:create
./scripts/mikro-orm-cli.sh sayho-bot local migration:up
```

### 테스트

```bash
pnpm test              # 전체 테스트 실행
pnpm test:watch        # watch 모드
pnpm test:cov          # 커버리지 리포트
pnpm test:e2e          # E2E 테스트
```

### 코드 품질

```bash
pnpm format            # Prettier 포맷팅
pnpm lint              # ESLint 검사 및 자동 수정
```

## Docker

각 서비스는 멀티 스테이지 Dockerfile을 제공합니다.

```bash
# 예: auth 서비스 이미지 빌드
docker build -f apps/auth/Dockerfile -t elivagar-auth .
```

| 서비스 | HTTP 포트 | gRPC 포트 |
|--------|-----------|-----------|
| auth | 4000 | 5000 |
| notification | 4100 | 5001 |
| sayho-bot | 4200 | 8000 |

## CI/CD

GitHub Actions를 통해 PR 생성 시 자동으로 테스트가 실행됩니다. 테스트 결과는 Discord 웹훅으로 알림이 전송됩니다.

## 프로젝트 구조 상세

```
elivagar/
├── apps/
│   ├── auth/src/
│   │   ├── configs/           # 서비스별 설정
│   │   ├── guards/            # gRPC 스로틀 가드
│   │   ├── jwt/               # JWT 토큰 서비스
│   │   ├── user/              # 사용자 엔티티, 리포지토리
│   │   └── main.ts
│   ├── notification/src/
│   │   ├── configs/           # 서비스별 설정
│   │   ├── discord/           # Discord 알림 통합
│   │   ├── notification/      # 알림 엔티티, 리포지토리
│   │   └── main.ts
│   └── sayho-bot/src/
│       ├── configs/           # 서비스별 설정
│       ├── common/            # AOP 데코레이터, Discord 예외
│       ├── discord/
│       │   ├── domain/        # 엔티티, 포트 (인터페이스)
│       │   ├── application/   # 유스케이스, 매니저
│       │   ├── infrastructure/# 어댑터 (Discord, YouTube, Voice)
│       │   └── presentation/  # 슬래시 커맨드, 이벤트 핸들러
│       ├── song/              # 곡 엔티티, 서비스, 리포지토리
│       └── main.ts
├── libs/
│   ├── core/src/
│   │   ├── bootstrap/         # AbstractMain 부트스트랩
│   │   ├── lifecycle/         # 연결 생명주기 관리
│   │   ├── configs/           # Zod 기반 설정 로딩
│   │   ├── logger/            # Winston 로거
│   │   ├── cls/               # Continuation-local storage
│   │   └── common/            # 가드, 인터셉터, 예외, 필터
│   ├── auth/src/              # 토큰 검증 (캐시 -> gRPC 폴백)
│   ├── grpc/src/              # proto 파일 및 생성 코드
│   ├── mikro/src/             # 베이스 엔티티, ORM 설정
│   ├── cache/src/             # Redis 캐시 모듈
│   └── kafka/src/             # Kafka 프로듀서/컨슈머
├── docker/
│   └── compose.local.yml      # 로컬 개발 인프라
├── scripts/
│   ├── mikro-orm-cli.sh       # MikroORM CLI 래퍼
│   └── clean-hot-updates.js   # HMR 파일 정리
├── test/
│   ├── factories/             # 테스트 팩토리
│   └── mocks/                 # 모듈 목
└── .github/
    ├── workflows/test.yml     # PR 테스트 자동화
    └── actions/               # Discord 알림 커스텀 액션
```

## 코딩 컨벤션

- **배럴 파일(index.ts) 사용 금지** - 항상 직접 경로로 임포트
- **TypeScript enum 사용 금지** - `as const` 객체 + `Union<T>` 타입 패턴 사용
- **경로 별칭 사용** - `@app/core`, `@app/grpc`, `@app/mikro`, `@app/cache`, `@app/kafka`, `@app/auth`, `@test`
- **엔티티 생성** - MikroORM `em.create()` 또는 `repository.create()` 사용 권장
- **리포지토리 패턴** - 모든 엔티티에 커스텀 `EntityRepository` 사용
- **UUIDv7** - 모든 UUID 기본키에 사용 (`uuid` v13)
- **환경 파일** - `.env.{environment}` 패턴 (예: `.env.local`)
- **파일 분류** - `.constant.ts` (런타임 값), `.interface.ts` (순수 타입)

## 라이선스

UNLICENSED
