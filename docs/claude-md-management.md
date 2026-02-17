# CLAUDE.md 관리 체계

## 개요

Claude Code는 `CLAUDE.md` 파일을 통해 프로젝트별 컨텍스트를 주입한다. 모노레포 규모가 커지면 단일 파일이 비대해지므로, 계층적 구조로 분리하여 관리한다.

## 현재 구조

```text
CLAUDE.md                      # 루트: 공통 규칙/구조 (~140줄)
├── apps/sayho-bot/CLAUDE.md   # Discord 헥사고날 아키텍처
└── libs/
    ├── auth/CLAUDE.md         # Auth 모듈, validation flow
    ├── cache/CLAUDE.md        # CacheService, @Cache() 데코레이터
    ├── core/CLAUDE.md         # CoreModule, lifecycle, error handling, bootstrap
    └── kafka/CLAUDE.md        # Kafka producer/consumer, topic 컨벤션
```

### 루트 CLAUDE.md (공통)

모든 세션에서 시스템 프롬프트로 로드된다. 포함 내용:

- Project Overview, Architecture (모노레포 구조, DB, gRPC)
- Common Commands (빌드, 테스트, 마이그레이션)
- Key Patterns 요약 (Entity, ConfigsService, MikroORM)
- Coding Conventions, Important Notes
- **150줄 이내 유지** (Anthropic 권장 기준)

### 하위 CLAUDE.md (상세)

해당 디렉토리 코드 작업 시 보조 참조용. 루트에서 제거된 상세 패턴을 포함한다.

| 파일 | 내용 |
|---|---|
| `libs/core/CLAUDE.md` | CoreModule global providers, Lifecycle (IManagedConnection, Startup/Shutdown Flow), Error & Response Handling, Bootstrap 13단계 |
| `libs/cache/CLAUDE.md` | CacheService, `@Cache()` 데코레이터 옵션 |
| `libs/kafka/CLAUDE.md` | IManagedConnection 구현, retry/drain, x-request-id 전파, Topic 컨벤션 |
| `libs/auth/CLAUDE.md` | registerAsync, Guard/EventListener providers, Cache-first validation, 데코레이터 |
| `apps/sayho-bot/CLAUDE.md` | Discord 디렉토리 구조, AOP 크로스커팅 |

## Claude Code 메모리 로딩 메커니즘

### 동작 확인된 것

| 메커니즘 | 설명 | 상태 |
|---|---|---|
| 루트 `CLAUDE.md` | 세션 시작 시 시스템 프롬프트로 로드 | **안정** |
| 상위 디렉토리 탐색 | CWD에서 루트까지 재귀적으로 CLAUDE.md 로드 | **안정** |
| `~/.claude/CLAUDE.md` | 전역 사용자 설정 | **안정** |

### 알려진 제한사항

#### 하위 디렉토리 CLAUDE.md (현재 사용 중)

공식 문서는 "하위 디렉토리 파일 접근 시 on-demand 로드"라고 명시하지만, 실제로는 불안정하다.

- [#2571](https://github.com/anthropics/claude-code/issues/2571): tool output에 첨부는 되지만, instruction을 따르지 않는 경우 있음 (Closed: NOT_PLANNED)
- [#3529](https://github.com/anthropics/claude-code/issues/3529): 하위 CLAUDE.md가 무시됨 (Closed: COMPLETED, 우려 미해소)

**현재 판단**: 보조 참조용으로는 유효하나, 핵심 규칙은 반드시 루트에 포함해야 한다.

#### `.claude/rules/` (대안으로 검토 후 보류)

path-specific frontmatter를 통한 조건부 로딩을 지원하지만, 더 심각한 버그가 있어 채택하지 않았다.

- [#16299](https://github.com/anthropics/claude-code/issues/16299): `paths:` 지정해도 세션 시작 시 전부 로드됨 (path scoping 무동작)
- [#21858](https://github.com/anthropics/claude-code/issues/21858): YAML 배열 문법 파싱 실패
- [#17204](https://github.com/anthropics/claude-code/issues/17204): 문서화된 포맷과 실제 동작 불일치

## 관리 원칙

1. **루트 150줄 이내**: 모든 세션에서 로드되므로 핵심만 유지
2. **상세는 하위로**: 해당 코드 작업 시에만 필요한 내용은 하위 CLAUDE.md로 분리
3. **핵심 규칙은 루트에**: 하위 CLAUDE.md 로딩이 불안정하므로, 반드시 지켜야 하는 규칙(Coding Conventions 등)은 루트에 유지
4. **하위 파일은 self-contained**: 루트 참조 없이 단독으로 이해 가능하게 작성
5. **정기 리뷰**: 서비스 추가/변경 시 루트 줄 수 확인, 필요시 상세 내용 하위로 이동

## 새 서비스/라이브러리 추가 시

1. 해당 디렉토리에 `CLAUDE.md` 생성
2. 루트 `CLAUDE.md`에 구조 트리 업데이트
3. 루트 줄 수가 150줄 초과 시 상세 내용을 하위로 이동
4. 이 문서의 "현재 구조" 섹션 업데이트

## 향후 개선

- Claude Code의 하위 CLAUDE.md / `.claude/rules/` 버그 수정 시 재평가
- 모니터링 대상 이슈: [#2571](https://github.com/anthropics/claude-code/issues/2571), [#16299](https://github.com/anthropics/claude-code/issues/16299)
