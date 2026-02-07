import { Module } from '@nestjs/common';
import { AopModule } from '@toss/nestjs-aop';
import { HandleVoiceStateUseCase } from './application/handle-voice-state.usecase';
import { LeaveChannelUseCase } from './application/leave-channel.usecase';
import { ManageQueueUseCase } from './application/manage-queue.usecase';
import { PlayMusicUseCase } from './application/play-music.usecase';
import { QueueStateManager } from './application/queue-state.manager';
import { SearchVideoUseCase } from './application/search-video.usecase';
import { DiscordService } from './discord.service';
import { DiscordContextAspect } from '../common/aop/discord-context.aspect';
import { DiscordErrorAspect } from '../common/aop/discord-error.aspect';
import { SongModule } from '../song/song.module';
import { AudioPlayerFactoryPort } from './domain/ports/audio-player.port';
import { MessageSenderPort } from './domain/ports/message-sender.port';
import { PoTokenServicePort } from './domain/ports/po-token.port';
import { StreamProviderPort } from './domain/ports/stream-provider.port';
import { VoiceConnectionManagerPort } from './domain/ports/voice-connection.port';
import { YoutubeSearchPort } from './domain/ports/youtube-search.port';
import { DiscordClientAdapter } from './infrastructure/discord-client/discord-client.adapter';
import { GuildInfraStateManager } from './infrastructure/discord-client/guild-infra-state.manager';
import { DiscordMessageSenderAdapter } from './infrastructure/discord-client/message-sender.adapter';
import { DiscordAudioPlayerFactory } from './infrastructure/voice/audio-player-factory.adapter';
import { StreamProviderAdapter } from './infrastructure/voice/stream-provider.adapter';
import { VoiceConnectionAdapter } from './infrastructure/voice/voice-connection.adapter';
import { PoTokenAdapter } from './infrastructure/youtube/po-token.adapter';
import { YoutubeSearchAdapter } from './infrastructure/youtube/youtube-search.adapter';
import { CommandHandler } from './presentation/commands/command.handler';
import { EventHandler } from './presentation/events/event.handler';

@Module({
  imports: [AopModule, SongModule],
  providers: [
    DiscordService,

    // Application
    QueueStateManager,
    SearchVideoUseCase,
    PlayMusicUseCase,
    ManageQueueUseCase,
    LeaveChannelUseCase,
    HandleVoiceStateUseCase,

    // Infrastructure
    DiscordClientAdapter,
    GuildInfraStateManager,

    // Port -> Adapter bindings
    { provide: YoutubeSearchPort, useClass: YoutubeSearchAdapter },
    { provide: PoTokenServicePort, useClass: PoTokenAdapter },
    { provide: StreamProviderPort, useClass: StreamProviderAdapter },
    { provide: VoiceConnectionManagerPort, useClass: VoiceConnectionAdapter },
    { provide: AudioPlayerFactoryPort, useClass: DiscordAudioPlayerFactory },
    { provide: MessageSenderPort, useClass: DiscordMessageSenderAdapter },

    // Presentation
    CommandHandler,
    EventHandler,

    // AOP Aspects
    DiscordContextAspect,
    DiscordErrorAspect,
  ],
})
export class DiscordModule {}
