import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { LoggerService } from '@app/core/logger/logger.service';
import { AudioPlayer, generateDependencyReport, VoiceConnection } from '@discordjs/voice';
import { Inject, Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  InteractionResponse,
  Message,
  REST,
  StageChannel,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { ChannelState, ChannelStateAdapter } from './channel-state.adapter';
import { PlayerAdapter } from './player.adapter';
import { HandleDiscordError } from '../../../common/aop/discord-error.aspect';
import { DiscordException } from '../../../common/exceptions/discord.exception';
import { SongService } from '../../../song/song.service';
import { Song } from '../../domain/entities/song';
import { IStreamProvider, StreamProviderPort } from '../../domain/ports/stream-provider.port';

type CommandFunction = (payload: Message | ChatInputCommandInteraction) => Promise<void>;

@Injectable()
export class DiscordClientAdapter {
  discordBotClient!: Client;
  public commands: Collection<string, CommandFunction> = new Collection();
  private rest!: REST;

  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
    private readonly songService: SongService,
    private readonly stateAdapter: ChannelStateAdapter,
    private readonly playerAdapter: PlayerAdapter,
    @Inject(StreamProviderPort) private readonly streamProvider: IStreamProvider,
    private readonly loggerService: LoggerService,
  ) {}

  @HandleDiscordError()
  public async init(): Promise<void> {
    this.discordBotClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.loggerService.verbose('init', generateDependencyReport());

    try {
      this.rest = new REST({ version: '10' }).setToken(this.configsService.DiscordConfig!.token);
      await this.discordBotClient.login(this.configsService.DiscordConfig!.token);
      this.loggerService.verbose('init', 'DiscordBotClient instance initialized');
    } catch (err) {
      console.error(err);
      throw new DiscordException('login failed', 'client');
    }
  }

  public formatMessageEmbed(
    url: string,
    queuedCount: number,
    queueLength: number,
    title: string,
    thumbnail: string,
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('Queued')
      .setURL(url)
      .setDescription(`Queued ${queuedCount} track${queuedCount === 1 ? '' : 's'}`)
      .addFields([
        { name: 'Total Queue', value: `${queueLength} tracks` },
        {
          name: 'Track',
          value: `:musical_note:  ${title} :musical_note: has been added to queue`,
        },
      ])
      .setThumbnail(thumbnail);
  }

  private async createAudioResourceWithRecovery(
    guildId: string,
    song: Song,
    channel: TextChannel,
  ): Promise<Awaited<ReturnType<IStreamProvider['createAudioResourceFromUrl']>> | null> {
    try {
      return await this.streamProvider.createAudioResourceFromUrl(song.url);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loggerService.error(
        'createAudioResourceWithRecovery',
        `Stream creation failed for ${song.title}: ${errorMessage}`,
      );
      await channel.send(`Failed to play: ${song.title}\nSkipping to next song...`);

      this.stateAdapter.removeCurrentSong(guildId);

      if (this.stateAdapter.getMusicQueue(guildId).length === 0) {
        this.stateAdapter.setIsPlaying(guildId, false);
        await channel.send('Queue is empty.');
      }

      return null;
    }
  }

  @HandleDiscordError()
  public async playSong(message: Message | ChatInputCommandInteraction): Promise<Message | void> {
    const guildId = message.guildId;
    if (!guildId) throw new DiscordException('guildId not specified', 'client');

    const channel = message.channel as TextChannel;
    const musicQueue = this.stateAdapter.getMusicQueue(guildId);
    if (!musicQueue.length) return channel.send('No Queue found');

    const currentSong = musicQueue[0];

    const resource = await this.createAudioResourceWithRecovery(guildId, currentSong, channel);
    if (!resource) {
      if (this.stateAdapter.getMusicQueue(guildId).length > 0) {
        return this.playSong(message);
      }
      return;
    }

    if (!message.guild) {
      return channel.send(`Error occurred on joining voice channel\nguild is not defined`);
    }

    // Get the actual voice channel from the guild
    const voiceChannel = message.guild.channels.cache.get(currentSong.voiceChannel.id) as
      | VoiceChannel
      | StageChannel
      | undefined;
    if (!voiceChannel) {
      return channel.send('Cannot find voice channel');
    }

    const connection = this.playerAdapter.getOrCreateConnection(
      guildId,
      message.guild,
      voiceChannel,
    );

    const player = this.playerAdapter.getOrCreatePlayer(
      { message, guildId, channel },
      async () => {
        await this.playSong(message);
      },
      () => {
        this.handleQueueEmpty(guildId, channel);
      },
    );

    try {
      this.playerAdapter.play(player, connection, resource);
      this.stateAdapter.setIsPlaying(guildId, true);
      await this.sendNowPlayingMessage(guildId, currentSong, channel);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.loggerService.error('playSong', err, errorMessage);
      await channel.send('Error occurred on player.play()');
      this.stateAdapter.setIsPlaying(guildId, false);
      throw new DiscordException(errorMessage, 'client');
    } finally {
      await this.songService.create(currentSong.url, currentSong.title);
    }
  }

  private async sendNowPlayingMessage(
    guildId: string,
    song: Song,
    channel: TextChannel,
  ): Promise<void> {
    this.deleteCurrentInfoMsg(guildId);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`:: Currently playing :arrow_forward: ::`)
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields([{ name: 'Duration', value: song.duration || '??:??' }]);

    const msg = await channel.send({ embeds: [embed] });
    this.stateAdapter.setCurrentInfoMsg(guildId, msg);
  }

  private handleQueueEmpty(guildId: string, channel: TextChannel): void {
    this.deleteCurrentInfoMsg(guildId);
    this.loggerService.debug('handleQueueEmpty', 'queue empty');

    setTimeout(() => {
      const queue = this.stateAdapter.getMusicQueue(guildId);
      const isPlaying = this.stateAdapter.getIsPlaying(guildId);

      if (queue.length === 0 && !isPlaying) {
        this.stateAdapter.clearQueue(guildId);
        this.stateAdapter.setIsPlaying(guildId, false);
        this.stateAdapter.setVolume(guildId, 1);

        channel
          .send(`Disconnected from channel due to inactivity`)
          .then((msg) =>
            setTimeout(
              () => msg.delete().catch(() => {}),
              this.configsService.DiscordConfig!.messageDeleteTimeout,
            ),
          );
        this.stateAdapter.getConnection(guildId)?.destroy();
        this.stateAdapter.deleteConnection(guildId);
      }
    }, 180000);
  }

  // Delegate methods to ChannelStateAdapter
  public deleteCurrentInfoMsg(guildId: string): void {
    this.stateAdapter.deleteCurrentInfoMsg(guildId);
  }

  public setDeleteQueue(guildId: string, message: Message | InteractionResponse): void {
    if (!guildId.length) {
      throw new DiscordException('guildId not specified', 'client', this.setDeleteQueue.name);
    }
    this.stateAdapter.addToDeleteQueue(guildId, message);
  }

  public removeFromDeleteQueue(guildId: string, id: string): void {
    this.stateAdapter.removeFromDeleteQueue(guildId, id);
  }

  public removeGuildFromDeleteQueue(guildId: string): void {
    this.stateAdapter.clearDeleteQueue(guildId);
  }

  public getConnection(guildId: string): VoiceConnection | null {
    return this.stateAdapter.getConnection(guildId);
  }

  public setConnection(guildId: string, conn: VoiceConnection): void {
    this.stateAdapter.setConnection(guildId, conn);
  }

  public deleteConnection(guildId: string): void {
    this.stateAdapter.deleteConnection(guildId);
  }

  public getTotalMusicQueue(): Map<string, ChannelState> {
    // Return a new map with all states
    const result = new Map<string, ChannelState>();
    // This would need proper implementation based on state adapter
    return result;
  }

  public getMusicQueue(guildId: string): readonly Song[] {
    return this.stateAdapter.getMusicQueue(guildId);
  }

  public setMusicQueue(guildId: string, songs: Song[]): void {
    this.stateAdapter.clearQueue(guildId);
    this.stateAdapter.addSongsToQueue(guildId, songs);
  }

  public shuffleMusicQueue(guildId: string): void {
    this.stateAdapter.shuffleMusicQueue(guildId);
  }

  public getIsPlaying(guildId: string): boolean {
    return this.stateAdapter.getIsPlaying(guildId);
  }

  public setIsPlaying(guildId: string, isPlaying: boolean): void {
    this.stateAdapter.setIsPlaying(guildId, isPlaying);
  }

  public getVolume(guildId: string): number {
    return this.stateAdapter.getVolume(guildId);
  }

  public setVolume(guildId: string, volume: number): void {
    this.stateAdapter.setVolume(guildId, volume);
  }

  public getPlayer(guildId: string): AudioPlayer {
    const player = this.stateAdapter.getPlayer(guildId);
    if (!player) throw new DiscordException('No player found', 'client', this.getPlayer.name);
    return player;
  }

  public setPlayer(guildId: string, player: AudioPlayer): void {
    this.stateAdapter.setPlayer(guildId, player);
  }

  public deletePlayer(guildId: string): void {
    this.stateAdapter.deletePlayer(guildId);
  }

  public getClient(): Client {
    return this.discordBotClient;
  }

  public getUser(): string | undefined {
    return this.discordBotClient.user?.tag;
  }

  public get Rest(): REST {
    return this.rest;
  }

  public set Rest(rest: REST) {
    this.rest = rest;
  }
}
