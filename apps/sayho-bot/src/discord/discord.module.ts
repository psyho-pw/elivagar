import { ConfigsService } from '@app/core/configs/configs.service';
import { KafkaModule } from '@app/kafka/kafka/kafka.module';
import { Module } from '@nestjs/common';
import { AopModule } from '@toss/nestjs-aop';
import { ConfigsServiceKey } from 'libs/core/src/configs/configs.constant';
import { PlayMusicUseCase } from './application/play-music.usecase';
import { QueueStateManager } from './application/queue-state.manager';
import { SearchVideoUseCase } from './application/search-video.usecase';
import { DiscordService } from './discord.service';
import { DiscordContextAspect } from '../common/aop/discord-context.aspect';
import { DiscordErrorAspect } from '../common/aop/discord-error.aspect';
import { SongModule } from '../song/song.module';
import { PoTokenServicePort } from './domain/ports/po-token.port';
import { StreamProviderPort } from './domain/ports/stream-provider.port';
import { VoiceConnectionManagerPort } from './domain/ports/voice-connection.port';
import { YoutubeSearchPort } from './domain/ports/youtube-search.port';
import { ChannelStateAdapter } from './infrastructure/discord-client/channel-state.adapter';
import { DiscordClientAdapter } from './infrastructure/discord-client/discord-client.adapter';
import { PlayerAdapter } from './infrastructure/discord-client/player.adapter';
import { StreamProviderAdapter } from './infrastructure/voice/stream-provider.adapter';
import { VoiceConnectionAdapter } from './infrastructure/voice/voice-connection.adapter';
import { PoTokenAdapter } from './infrastructure/youtube/po-token.adapter';
import { YoutubeSearchAdapter } from './infrastructure/youtube/youtube-search.adapter';
import { CommandHandler } from './presentation/commands/command.handler';
import { EventHandler } from './presentation/events/event.handler';

@Module({
  imports: [
    AopModule,
    SongModule,
    KafkaModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        kafka: configsService.KafkaConfig,
      }),
      inject: [ConfigsServiceKey],
    }),
  ],
  providers: [
    DiscordService,

    // Application
    QueueStateManager,
    SearchVideoUseCase,
    PlayMusicUseCase,

    // Infrastructure
    DiscordClientAdapter,
    ChannelStateAdapter,
    PlayerAdapter,

    // Port -> Adapter bindings
    { provide: YoutubeSearchPort, useClass: YoutubeSearchAdapter },
    { provide: PoTokenServicePort, useClass: PoTokenAdapter },
    { provide: StreamProviderPort, useClass: StreamProviderAdapter },
    { provide: VoiceConnectionManagerPort, useClass: VoiceConnectionAdapter },

    // Presentation
    CommandHandler,
    EventHandler,

    // AOP Aspects
    DiscordContextAspect,
    DiscordErrorAspect,
  ],
})
export class DiscordModule {}
