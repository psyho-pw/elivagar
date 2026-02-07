# Discord Module

sayho-bot의 Discord 음악 봇 모듈. 헥사고날 아키텍처(Ports & Adapters)로 구성되어 있다.

## 디렉토리 구조

```
discord/
├── domain/
│   ├── entities/        # Song, QueueState
│   └── ports/           # 인터페이스 정의 (YoutubeSearch, VoiceConnection, StreamProvider 등)
├── application/
│   ├── play-music.usecase.ts
│   ├── search-video.usecase.ts
│   ├── manage-queue.usecase.ts
│   ├── leave-channel.usecase.ts
│   ├── handle-voice-state.usecase.ts
│   └── queue-state.manager.ts
├── infrastructure/
│   ├── discord-client/   # DiscordClientAdapter, MessageSenderAdapter, GuildInfraStateManager
│   ├── voice/            # VoiceConnectionAdapter, StreamProviderAdapter, AudioPlayerFactory
│   └── youtube/          # YoutubeSearchAdapter, PoTokenAdapter
└── presentation/
    ├── commands/          # CommandHandler (슬래시 커맨드 처리)
    ├── events/            # EventHandler (interaction, message, voiceState 이벤트)
    └── helpers/           # Embed 빌더 헬퍼
```

## Port → Adapter 바인딩

| Port | Adapter | 역할 |
|------|---------|------|
| `YoutubeSearchPort` | `YoutubeSearchAdapter` | YouTube API로 영상 검색/조회 |
| `PoTokenServicePort` | `PoTokenAdapter` | YouTube 스트리밍용 PoToken 생성/갱신 |
| `StreamProviderPort` | `StreamProviderAdapter` | ytdl-core로 오디오 스트림 생성 |
| `VoiceConnectionManagerPort` | `VoiceConnectionAdapter` | Discord 음성 채널 연결 관리 |
| `AudioPlayerFactoryPort` | `DiscordAudioPlayerFactory` | AudioPlayer 인스턴스 생성 |
| `MessageSenderPort` | `DiscordMessageSenderAdapter` | Embed 메시지 전송/삭제 |

DI 바인딩은 `discord.module.ts`에서 `{ provide: PortSymbol, useClass: AdapterClass }` 패턴으로 등록한다.

## 초기화 흐름

`DiscordService.onModuleInit()`에서 순차적으로 실행된다.

```
1. Discord.js Client 생성
   - Intents: Guilds, GuildMembers, GuildMessages, GuildVoiceStates, MessageContent

2. client.login(token)

3. Adapter에 Client 주입
   - MessageSenderAdapter.setClient(client)
   - VoiceConnectionAdapter.setClient(client)
   (Client가 런타임에 생성되므로 setClient 패턴 사용)

4. Slash Command 등록
   - play(p), skip(s), queue(q), shuffle(sh), empty(eq), leave(l), help(h)
   - REST API로 Discord에 등록 후 commands Collection에 저장

5. 이벤트 리스너 등록
   - ready: 봇 준비 완료 로그
   - interactionCreate → EventHandler
   - messageCreate → EventHandler
   - voiceStateUpdate → EventHandler
```

## 커맨드 처리 흐름

### /play 전체 흐름

```
사용자: /play "노래"  또는  !p "노래"
    │
    ▼
Discord Gateway
    │  interactionCreate / messageCreate
    ▼
EventHandler (Presentation)
    │  @WithDiscordContext + @HandleDiscordError
    │  - Slash Command → commandHandler()
    │  - Select Menu  → selectMenuHandler()
    │  - 텍스트 메시지 → messageCreate()
    ▼
CommandHandler.play() (Presentation)
    │  1. 유효성 검사: guildId, 음성 채널 접속 여부, 봇 권한(Connect + Speak)
    │  2. 입력 파싱 (URL 패턴 매칭):
    │     ├─ 플레이리스트 URL → playlistHandler()
    │     ├─ 단일 영상 URL   → singleVidHandler()
    │     └─ 텍스트 검색     → searchHandler() → Select Menu 10개 표시
    ▼
SearchVideoUseCase (Application)
    │  searchByQuery() / getByUrl() / getPlaylist()
    │  → YoutubeSearchPort로 검색 후 Song[] 도메인 엔티티로 변환
    ▼
PlayMusicUseCase.play() (Application)
    │  1. QueueStateManager.getOrCreate(guildId)
    │  2. queueState.addSongs(songs)
    │  3. if (!isPlaying) → playNext()
    │  4. Return PlayMusicResult { position, length }
    ▼
playNext() ── 핵심 재생 루프 (아래 섹션 참조)
```

### 다른 커맨드 흐름

| 커맨드 | 흐름 |
|--------|------|
| `/skip` | CommandHandler → PlayMusicUseCase.skip() → removeCurrent → playNext() |
| `/queue` | CommandHandler → ManageQueueUseCase.getQueue() → Embed 표시 |
| `/shuffle` | CommandHandler → ManageQueueUseCase.shuffle() (현재 곡 유지, 나머지 Fisher-Yates) |
| `/empty` | CommandHandler → ManageQueueUseCase.clearQueue() |
| `/leave` | CommandHandler → LeaveChannelUseCase.execute() → 연결 해제 + 상태 초기화 |
| `/help` | CommandHandler → help Embed 표시 |

## 음악 재생 흐름 (playNext 상세)

`PlayMusicUseCase.playNext()`는 모든 재생의 단일 진입점이다.

```
playNext(guildId, voiceChannel, channelId)
    │
    ├─ 큐가 비었으면?
    │   → handleQueueEmpty() → 180초 후 idle disconnect 예약 → return
    │
    ▼
1. 오디오 리소스 생성 (with retry)
    │  StreamProviderAdapter:
    │    - PoTokenAdapter.getPoToken() (YouTube 인증 토큰)
    │    - YtdlCore.download(url, { poToken, proxy, format: opus })
    │    - createAudioResource(stream)
    │  실패 시: 에러 메시지 → 큐에서 제거 → 다음 곡으로 재귀 호출
    │  네트워크 에러 시 최대 2회 재시도
    ▼
2. 음성 채널 연결
    │  VoiceConnectionAdapter:
    │    - 기존 연결 있으면 재사용
    │    - joinVoiceChannel() → entersState(Ready, timeout: 30s)
    ▼
3. 오디오 플레이어 생성/재사용
    │  AudioPlayerFactory.createPlayer({
    │    onIdle:  () => removeCurrent() → playNext()   ← 자동 다음 곡
    │    onError: (err) => skip → playNext()            ← 에러 건너뛰기
    │  })
    ▼
4. 재생 시작
    │  connection.subscribe(player)
    │  player.play(audioResource)
    │  queueState.isPlaying = true
    ▼
5. UI 업데이트
    │  MessageSenderAdapter.sendNowPlaying() → "Currently playing" Embed
    │  이전 info 메시지 삭제
    │  GuildInfraStateManager에 새 메시지 저장
    ▼
6. 재생 기록 저장
    SongService.create() → DB 기록
```

### 자동 재생 루프

```
곡 재생 → 곡 끝남 (player idle)
              │
              ▼
         onIdle 콜백
              │
              ├── removeCurrent()
              └── playNext() ── 다음 곡 있으면 반복
                                     │
                                큐가 비면
                                     │
                                     ▼
                           handleQueueEmpty()
                           180초 대기 후 disconnect
```

## 상태 관리 (2계층 분리)

Per-guild 상태를 도메인과 인프라로 분리하여 관리한다.

### QueueStateManager (Application Layer)

`Map<guildId, QueueState>` — 도메인 상태 (무엇이 재생되는가)

```typescript
QueueState {
  #queue: Song[]          // 재생 큐
  #isPlaying: boolean     // 재생 중 여부
  #volume: number         // 볼륨 (0~2)

  addSong() / addSongs()  // 큐에 추가
  removeCurrent()          // 현재 곡 제거
  shuffle()                // Fisher-Yates (현재 곡은 유지)
  clear()                  // 큐 비우기
  reset()                  // 전체 초기화
}
```

### GuildInfraStateManager (Infrastructure Layer)

`Map<guildId, GuildInfraState>` — 인프라 상태 (어떻게 재생하는가)

```typescript
GuildInfraState {
  player: IAudioPlayer | null       // 오디오 플레이어 인스턴스
  currentInfoMessage: SentMessage   // 현재 재생 중 Embed 메시지
  deleteQueue: Map<string, Message> // 정리 대상 메시지 (Select Menu 등)
}
```

## AOP (Cross-Cutting Concerns)

`@toss/nestjs-aop`를 사용한 관심사 분리. 데코레이터 순서: 바깥 → 안쪽으로 실행된다.

### @WithDiscordContext()

```
DiscordContextAspect.wrap():
  1. UUIDv7로 requestId 생성
  2. CLS 컨텍스트 설정 (requestId, controllerCtx, methodCtx)
  3. clsService.runWith() 안에서 메서드 실행
```

### @HandleDiscordError()

```
DiscordErrorAspect.wrap():
  try {
    메서드 실행
  } catch (error) {
    1. GeneralException에 context 설정
    2. LoggerService로 에러 로깅
    3. Kafka 이벤트 발행: SayhoBot.ErrorOccurred { message, stack, context }
    4. bubble: true  → rethrow (호출자에게 에러 전파)
       bubble: false → 무시 (기본값)
  }
```

## 이벤트 핸들링

### voiceStateUpdate (자동 퇴장)

```
사용자가 음성 채널에서 나감
    │
    ▼
봇이 혼자인가? ── 아니면 → return
    │ (혼자)
    ▼
5초 대기 → 여전히 혼자? ── 아니면 → return
    │ (혼자)
    ▼
HandleVoiceStateUseCase.handleBotAlone()
    - "바윙~" 메시지 전송
    - 음성 채널 연결 해제
    - 큐 상태 초기화
```

### selectMenuHandler (검색 결과 선택)

```
검색 결과 Select Menu에서 곡 선택
    │
    ▼
EventHandler.selectMenuHandler()
    │
    ├── SearchVideoUseCase.getByUrl() → 영상 메타데이터 조회
    ├── PlayMusicUseCase.play() → 큐에 추가 + 재생
    ├── Queued Embed 표시
    └── deleteQueue에서 Select Menu 메시지 제거
```

## PoToken 생명주기

YouTube 스트리밍에 필요한 인증 토큰을 자동 관리한다.

```
PoTokenAdapter:
  - onModuleInit()        → 초기 토큰 생성
  - @Cron(EVERY_4_HOURS)  → 자동 갱신 (TTL 6시간 전에 갱신)

  생성 과정:
    1. JSDOM 환경 설정
    2. YouTube API에서 visitorData 획득
    3. bgutils-js (BG.Challenge)로 poToken 생성
    4. PoTokenData 저장

  동시성 가드: isRefreshing 플래그로 중복 갱신 방지
  StreamProviderAdapter에서 ytdl-core download 시 poToken 전달
```

## 전체 요청 흐름 요약

```
Discord 사용자
    │  /play "노래"
    ▼
Discord Gateway → DiscordService (이벤트 리스너)
    │
    ▼
EventHandler ─── @WithDiscordContext (CLS) + @HandleDiscordError (AOP)
    │
    ▼
CommandHandler.play() ─── 유효성 검사 + 입력 파싱
    │
    ▼
SearchVideoUseCase ─── YoutubeSearchPort → YoutubeSearchAdapter (YouTube API)
    │
    ▼
PlayMusicUseCase.play() ─── QueueStateManager에 곡 추가
    │
    ▼
playNext()
    ├── StreamProviderPort → StreamProviderAdapter (ytdl-core + PoToken)
    ├── VoiceConnectionMgrPort → VoiceConnectionAdapter (joinVoiceChannel)
    ├── AudioPlayerFactoryPort → DiscordAudioPlayerFactory
    ├── player.play(resource) ─── 재생 시작
    ├── MessageSenderPort → Embed "Currently playing" 전송
    └── SongService.create() ─── DB 기록

    곡 종료 → onIdle → removeCurrent → playNext() (루프)
    큐 비움 → 180초 대기 → disconnect
```
