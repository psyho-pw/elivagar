import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { LoggerService } from '@app/core/logger/logger.service';
import { Inject, Injectable } from '@nestjs/common';
import { APIEmbedField } from 'discord-api-types/v10';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionResponse,
  Message,
  PermissionFlagsBits,
  StageChannel,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { HandleDiscordError } from '../../../common/aop/discord-error.aspect';
import { DiscordException } from '../../../common/exceptions/discord.exception';
import { SearchVideoUseCase } from '../../application/search-video.usecase';
import { VoiceChannelInfo } from '../../domain/entities/song';
import { IYoutubeSearch, YoutubeSearchPort } from '../../domain/ports/youtube-search.port';
import { DiscordClientAdapter } from '../../infrastructure/discord-client/discord-client.adapter';

interface ParsedPlayCommand {
  content: string;
  voiceChannel: VoiceChannel | StageChannel;
}

interface SelectListItem {
  label: string;
  description: string;
  value: string;
}

@Injectable()
export class CommandHandler {
  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
    private readonly discordClient: DiscordClientAdapter,
    private readonly searchVideoUseCase: SearchVideoUseCase,
    @Inject(YoutubeSearchPort) private readonly youtubeSearch: IYoutubeSearch,
    private readonly loggerService: LoggerService,
  ) {}

  private getVoiceChannelFromPayload(
    payload: Message | ChatInputCommandInteraction,
  ): VoiceChannel | StageChannel | null {
    if (payload instanceof Message) {
      return payload.member?.voice.channel ?? null;
    }
    return payload.guild?.members.cache.get(payload.member?.user.id ?? '')?.voice.channel ?? null;
  }

  private toVoiceChannelInfo(
    voiceChannel: VoiceChannel | StageChannel,
    guildId: string,
  ): VoiceChannelInfo {
    return {
      id: voiceChannel.id,
      guildId,
      name: voiceChannel.name,
    };
  }

  @HandleDiscordError({ bubble: true })
  private async playlistHandler(
    url: string,
    voiceChannel: VoiceChannel | StageChannel,
    message: Message | ChatInputCommandInteraction,
  ): Promise<void> {
    this.loggerService.info('playlistHandler', 'Playlist detected');
    if (!message.guildId) throw new DiscordException('guild is not specified', 'command');

    const voiceChannelInfo = this.toVoiceChannelInfo(voiceChannel, message.guildId);
    const songs = await this.searchVideoUseCase.getPlaylist(url, voiceChannelInfo);
    const messageChannel = message.channel as TextChannel;

    if (!songs.length) {
      const msg = await messageChannel.send('No videos found');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const musicQueue = [...this.discordClient.getMusicQueue(message.guildId)];
    for (const song of songs) {
      musicQueue.push(song);
    }
    this.discordClient.setMusicQueue(message.guildId, musicQueue);

    this.loggerService.info('playlistHandler', `queue length: ${musicQueue.length}`);

    const reply = await message.reply({
      embeds: [
        this.discordClient.formatMessageEmbed(
          url,
          songs.length,
          musicQueue.length,
          songs[0]?.title ?? 'Unknown',
          songs[0]?.thumbnail ?? '',
        ),
      ],
    });
    setTimeout(() => reply.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);

    if (!this.discordClient.getIsPlaying(message.guildId)) {
      await this.discordClient.playSong(message);
    }
  }

  @HandleDiscordError({ bubble: true })
  private async singleVidHandler(
    url: string,
    voiceChannel: VoiceChannel | StageChannel,
    message: Message | ChatInputCommandInteraction,
  ): Promise<void> {
    this.loggerService.info('singleVidHandler', 'Single video/song detected');
    if (!message.guildId) throw new DiscordException('guild is not specified', 'command');

    const voiceChannelInfo = this.toVoiceChannelInfo(voiceChannel, message.guildId);
    const song = await this.searchVideoUseCase.getByUrl(url, voiceChannelInfo);

    if (!song) {
      const msg = await message.reply('Video is either private or it does not exist');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const musicQueue = [...this.discordClient.getMusicQueue(message.guildId)];
    musicQueue.push(song);
    this.discordClient.setMusicQueue(message.guildId, musicQueue);

    this.loggerService.info('singleVidHandler', `Queue length: ${musicQueue.length}`);

    const reply = await message.reply({
      embeds: [
        this.discordClient.formatMessageEmbed(
          url,
          1,
          musicQueue.length,
          song.title,
          song.thumbnail,
        ),
      ],
    });
    setTimeout(() => reply.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);

    if (!this.discordClient.getIsPlaying(message.guildId)) {
      await this.discordClient.playSong(message);
    }
  }

  @HandleDiscordError({ bubble: true })
  private async searchHandler(
    searchTxt: string,
    payload: Message | ChatInputCommandInteraction,
  ): Promise<void> {
    this.loggerService.info('searchHandler', 'Search detected');

    searchTxt = searchTxt.trim();
    const results = await this.youtubeSearch.searchVideos(searchTxt, 10);

    const list: SelectListItem[] = results.map((item) => ({
      label: item.title.slice(0, 100),
      description: item.url.slice(0, 100),
      value: item.url,
    }));

    const selectList: Message | InteractionResponse = await payload.reply({
      content: `'${searchTxt}' 검색 결과`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: 'select',
              options: list,
              placeholder: '재생할 노래 선택',
              max_values: 1,
            },
          ],
        },
      ],
    });

    let replyMessage: Message | undefined;
    if (selectList instanceof Message) {
      replyMessage = selectList;
    } else if (payload instanceof ChatInputCommandInteraction) {
      replyMessage = await payload.fetchReply();
    }

    if (!replyMessage) {
      throw new DiscordException('cannot specify reply message object', 'command');
    }
    this.discordClient.setDeleteQueue(payload.guildId ?? '', replyMessage);
  }

  @HandleDiscordError()
  private async parsePlayCommand(
    payload: Message | ChatInputCommandInteraction,
  ): Promise<ParsedPlayCommand | null> {
    if (payload instanceof ChatInputCommandInteraction) {
      const content = payload.options.getString('input') ?? '';
      if (!content.length) {
        const msg = await payload.reply(`parameter count doesn't match`);
        setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
        return null;
      }

      const member = payload.guild?.members.cache.get(payload.member?.user.id ?? '');
      if (!member?.voice.channel) return null;

      return { content, voiceChannel: member.voice.channel };
    }

    const args = payload.content
      .slice(this.configsService.DiscordConfig.commandPrefix.length)
      .trim()
      .split(/ +/g);

    if (args.length < 2) {
      const msg = await payload.reply(`parameter count doesn't match`);
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return null;
    }

    args.shift();
    const content = args.join(' ');

    if (!payload.member?.voice.channel) return null;

    return { content, voiceChannel: payload.member.voice.channel };
  }

  @HandleDiscordError()
  public async play(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    const musicQueue = this.discordClient.getMusicQueue(payload.guildId);
    const parsedCommand = await this.parsePlayCommand(payload);

    if (!parsedCommand) {
      const msg = await payload.reply('You need to be in a voice channel to play music');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const { content, voiceChannel } = parsedCommand;
    const permissions = voiceChannel.permissionsFor(payload.client.user);

    if (!permissions) {
      const msg = await payload.reply('Permission Error');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const hasPermission =
      permissions.has(PermissionFlagsBits.Connect) && permissions.has(PermissionFlagsBits.Speak);

    if (!hasPermission) {
      const msg = await payload.reply(
        'I need the permissions to join and speak in your voice channel',
      );
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    if (!this.discordClient.getIsPlaying(payload.guildId) && musicQueue.length === 1) {
      const queue = [...musicQueue];
      queue.shift();
      this.discordClient.setMusicQueue(payload.guildId, queue);
      this.discordClient.setIsPlaying(payload.guildId, false);
    }

    const playlistCheck =
      content.match(/^(?!.*\?.*\bv=)https:\/\/(www\.)?youtube\.com\/.*\?.*\blist=.*$/) ||
      content.match(/https:\/\/music\.youtube\.com\/playlist\?list=.*/);
    const vidSongCheck =
      content.match(/https:\/\/(www\.)?youtube\.com\/watch\?v=.*/) ||
      content.match(/https:\/\/youtu\.be\/.*/) ||
      content.match(/https:\/\/music\.youtube\.com\/watch\?v=.*/);

    try {
      if (playlistCheck) await this.playlistHandler(content, voiceChannel, payload);
      else if (vidSongCheck) await this.singleVidHandler(content, voiceChannel, payload);
      else await this.searchHandler(content, payload);
    } catch (err) {
      this.discordClient.setIsPlaying(payload.guildId, false);
      throw err;
    }
  }

  @HandleDiscordError()
  public async emptyQueue(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!this.getVoiceChannelFromPayload(payload)) {
      const msg = await payload.reply('You have to be in a voice channel to clear queue music');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    const queue = this.discordClient.getMusicQueue(payload.guildId);
    if (queue.length === 0) {
      const msg = await payload.reply('Queue is empty');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    this.discordClient.setMusicQueue(payload.guildId, queue[0] ? [queue[0]] : []);

    const msg = await payload.reply('queue cleared');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async help(payload: Message | ChatInputCommandInteraction): Promise<void> {
    const discordConfig = this.configsService.DiscordConfig;
    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('Commands')
      .addFields([
        { name: 'prefix', value: discordConfig.commandPrefix },
        { name: 'p', value: `음악 재생 => ${discordConfig.commandPrefix}p [uri]` },
        { name: 's', value: `음악 스킵 => ${discordConfig.commandPrefix}s` },
        { name: 'q', value: `음악 큐 조회 => ${discordConfig.commandPrefix}q` },
        { name: 'eq', value: `음악 큐 제거 => ${discordConfig.commandPrefix}eq` },
        { name: 'l', value: `내보내기 => ${discordConfig.commandPrefix}l` },
      ]);

    const msg = await payload.reply({ embeds: [embed] });
    setTimeout(() => msg.delete(), discordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async leave(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!this.getVoiceChannelFromPayload(payload)) {
      const msg = await payload.reply('You have to be in a voice channel to make bot leave');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    this.discordClient.setMusicQueue(payload.guildId, []);
    this.discordClient.setIsPlaying(payload.guildId, false);
    this.discordClient.deleteCurrentInfoMsg(payload.guildId);
    this.discordClient.getConnection(payload.guildId)?.destroy();
    this.discordClient.deleteConnection(payload.guildId);

    const msg = await payload.reply('bye bye ,,,');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async queue(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!this.getVoiceChannelFromPayload(payload)) {
      await payload.reply('You have to be in a voice channel to see queue');
      return;
    }
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    const musicQueue = this.discordClient.getMusicQueue(payload.guildId);
    if (musicQueue.length <= 1) {
      const msg = await payload.reply('Queue is empty');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('Queue')
      .setThumbnail(musicQueue[1]?.thumbnail ?? '');

    const fields: APIEmbedField[] = [];
    musicQueue.forEach((item, idx) => {
      if (idx !== 0 && idx < 26) {
        fields.push({ name: `${idx}`, value: `${item.title}` });
      }
    });
    embed.addFields(fields);

    const msg = await payload.reply({ embeds: [embed] });
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async skip(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!this.getVoiceChannelFromPayload(payload)) {
      const reply = await payload.reply('You have to be in a voice channel to see queue');
      setTimeout(() => reply.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    this.loggerService.verbose('skip', 'Skipping song...');
    const musicQueue = this.discordClient.getMusicQueue(payload.guildId);
    this.discordClient.deleteCurrentInfoMsg(payload.guildId);

    if (musicQueue.length <= 1) {
      const reply = await payload.reply('Nothing to play');
      setTimeout(() => reply.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      this.discordClient.setMusicQueue(payload.guildId, []);
      this.discordClient.getPlayer(payload.guildId).stop();
      return;
    }

    const queue = [...musicQueue];
    queue.shift();
    this.discordClient.setMusicQueue(payload.guildId, queue);
    this.discordClient.setIsPlaying(payload.guildId, false);
    await this.discordClient.playSong(payload);

    const msg = await payload.reply('Skipping ...');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async shuffle(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    this.discordClient.shuffleMusicQueue(payload.guildId);

    const msg = await payload.reply('Queue shuffled');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }
}
