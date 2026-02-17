import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { LoggerService } from '@app/core/logger/logger.service';
import { Inject, Injectable } from '@nestjs/common';
import { PlayMusicRequest, PlayMusicResult, SkipResult } from './play-music.interface';
import { QueueStateManager } from './queue-state.manager';
import { ConfigsService } from '../../configs/configs.service';
import { SongService } from '../../song/song.service';
import { VoiceChannelInfo } from '../domain/entities/song';
import {
  AudioPlayerFactoryPort,
  AudioResource,
  IAudioPlayerFactory,
} from '../domain/ports/audio-player.port';
import { IMessageSender, MessageSenderPort } from '../domain/ports/message-sender.port';
import { IStreamProvider, StreamProviderPort } from '../domain/ports/stream-provider.port';
import {
  IVoiceConnectionManager,
  VoiceConnectionManagerPort,
} from '../domain/ports/voice-connection.port';
import { GuildInfraStateManager } from '../infrastructure/discord-client/guild-infra-state.manager';

@Injectable()
export class PlayMusicUseCase {
  private readonly idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly queueStateManager: QueueStateManager,
    private readonly guildInfraStateManager: GuildInfraStateManager,
    @Inject(StreamProviderPort) private readonly streamProvider: IStreamProvider,
    @Inject(VoiceConnectionManagerPort)
    private readonly voiceConnectionManager: IVoiceConnectionManager,
    @Inject(AudioPlayerFactoryPort) private readonly audioPlayerFactory: IAudioPlayerFactory,
    @Inject(MessageSenderPort) private readonly messageSender: IMessageSender,
    private readonly songService: SongService,
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
    private readonly loggerService: LoggerService,
  ) {}

  async play(request: PlayMusicRequest): Promise<PlayMusicResult> {
    const { guildId, songs, voiceChannel, channelId } = request;
    const queueState = this.queueStateManager.getOrCreate(guildId);
    const wasPlaying = queueState.isPlaying;
    const positionBefore = queueState.length;

    queueState.addSongs(songs);

    if (!wasPlaying) {
      queueState.isPlaying = true;
      this.clearIdleTimer(guildId);
      try {
        await this.playNext(guildId, voiceChannel, channelId);
      } catch (error) {
        queueState.isPlaying = false;
        throw error;
      }
    }

    return {
      started: !wasPlaying,
      queuePosition: positionBefore + 1,
      totalInQueue: queueState.length,
    };
  }

  async playNext(
    guildId: string,
    voiceChannel: VoiceChannelInfo,
    channelId: string,
  ): Promise<void> {
    const queueState = this.queueStateManager.get(guildId);
    if (!queueState || queueState.isEmpty) {
      this.handleQueueEmpty(guildId, channelId);
      return;
    }

    const currentSong = queueState.currentSong;
    if (!currentSong) {
      this.handleQueueEmpty(guildId, channelId);
      return;
    }

    const resource = await this.createAudioResourceWithRecovery(
      guildId,
      currentSong.url,
      currentSong.title,
      channelId,
    );
    if (!resource) {
      if (queueState.length > 0) {
        await this.playNext(guildId, voiceChannel, channelId);
      }
      return;
    }

    const connection = await this.voiceConnectionManager.getOrCreateConnection(voiceChannel);

    let player = this.guildInfraStateManager.getPlayer(guildId);
    if (!player) {
      player = this.audioPlayerFactory.createPlayer({
        onIdle: async () => {
          const qs = this.queueStateManager.get(guildId);
          if (qs) {
            qs.removeCurrent();
            if (!qs.isEmpty) {
              await this.playNext(guildId, voiceChannel, channelId);
            } else {
              qs.isPlaying = false;
              this.handleQueueEmpty(guildId, channelId);
            }
          }
        },
        onError: (error) => {
          this.loggerService.error(
            'PlayMusicUseCase.onError',
            `Player error for guild ${guildId}:`,
            error.message,
          );
          const qs = this.queueStateManager.get(guildId);
          if (qs) {
            qs.removeCurrent();
            if (!qs.isEmpty) {
              this.playNext(guildId, voiceChannel, channelId);
            } else {
              qs.isPlaying = false;
              this.handleQueueEmpty(guildId, channelId);
            }
          }
        },
      });
      this.guildInfraStateManager.setPlayer(guildId, player);
    }

    connection.subscribe(player);
    player.play(resource);

    // Send now-playing message
    this.guildInfraStateManager.deleteCurrentInfoMessage(guildId);
    const sentMsg = await this.messageSender.sendNowPlaying(channelId, currentSong);
    this.guildInfraStateManager.setCurrentInfoMessage(guildId, sentMsg);

    // Record song play
    await this.songService.create(currentSong.url, currentSong.title).catch((err) => {
      this.loggerService.error('PlayMusicUseCase.playNext', 'Failed to record song:', String(err));
    });
  }

  async skip(
    guildId: string,
    voiceChannel: VoiceChannelInfo,
    channelId: string,
  ): Promise<SkipResult> {
    const queueState = this.queueStateManager.get(guildId);
    if (!queueState || queueState.isEmpty) {
      return { skipped: false, nextSong: null, queueEmpty: true };
    }

    this.guildInfraStateManager.deleteCurrentInfoMessage(guildId);
    queueState.removeCurrent();

    if (!queueState.isEmpty) {
      const nextSong = queueState.currentSong ?? null;
      await this.playNext(guildId, voiceChannel, channelId);
      return { skipped: true, nextSong, queueEmpty: false };
    }

    this.stop(guildId);
    return { skipped: true, nextSong: null, queueEmpty: true };
  }

  stop(guildId: string): void {
    const queueState = this.queueStateManager.get(guildId);
    if (queueState) {
      queueState.reset();
    }

    const player = this.guildInfraStateManager.getPlayer(guildId);
    if (player) {
      player.stop();
    }

    this.voiceConnectionManager.destroyConnection(guildId);
    this.guildInfraStateManager.deletePlayer(guildId);
    this.guildInfraStateManager.deleteCurrentInfoMessage(guildId);
    this.clearIdleTimer(guildId);
  }

  private async createAudioResourceWithRecovery(
    guildId: string,
    url: string,
    title: string,
    channelId: string,
  ): Promise<AudioResource | null> {
    try {
      return await this.streamProvider.createAudioResourceFromUrl(url);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loggerService.error(
        'PlayMusicUseCase.createAudioResourceWithRecovery',
        `Stream creation failed for ${title}: ${errorMessage}`,
      );
      await this.messageSender.sendError(
        channelId,
        `Failed to play: ${title}\nSkipping to next song...`,
      );

      const queueState = this.queueStateManager.get(guildId);
      if (queueState) {
        queueState.removeCurrent();
        if (queueState.isEmpty) {
          queueState.isPlaying = false;
          await this.messageSender.sendError(channelId, 'Queue is empty.');
        }
      }

      return null;
    }
  }

  private handleQueueEmpty(guildId: string, channelId: string): void {
    this.guildInfraStateManager.deleteCurrentInfoMessage(guildId);
    this.loggerService.debug('PlayMusicUseCase.handleQueueEmpty', 'queue empty');

    this.scheduleIdleDisconnect(guildId, channelId);
  }

  private scheduleIdleDisconnect(guildId: string, channelId: string): void {
    this.clearIdleTimer(guildId);

    const timer = setTimeout(async () => {
      const queueState = this.queueStateManager.get(guildId);
      if (queueState && queueState.isEmpty && !queueState.isPlaying) {
        this.stop(guildId);

        const sentMsg = await this.messageSender.sendError(
          channelId,
          'Disconnected from channel due to inactivity',
        );
        setTimeout(
          () => sentMsg.delete().catch(() => {}),
          this.configsService.DiscordConfig.messageDeleteTimeout,
        );
      }
      this.idleTimers.delete(guildId);
    }, 180000);

    this.idleTimers.set(guildId, timer);
  }

  private clearIdleTimer(guildId: string): void {
    const existing = this.idleTimers.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.idleTimers.delete(guildId);
    }
  }
}
