# apps/sayho-bot

## Discord (Hexagonal Architecture)

```text
apps/sayho-bot/src/discord/
├── domain/          # entities (song, queue-state), ports (interfaces)
├── application/     # use cases (play-music, search-video, leave-channel, manage-queue, handle-voice-state)
├── infrastructure/  # adapters: discord-client, voice, youtube
└── presentation/    # commands, events, helpers
```

AOP cross-cutting: `DiscordContextAspect`, `DiscordErrorAspect`.
