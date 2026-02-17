import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { LoggerService } from '@app/core/logger/logger.service';
import { Inject, Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  Message,
  PermissionFlagsBits,
  StageChannel,
  VoiceChannel,
} from 'discord.js';
import { HandleDiscordError } from '../../../common/aop/discord-error.aspect';
import { DiscordException } from '../../../common/exceptions/discord.exception';
import { ConfigsService } from '../../../configs/configs.service';
import { LeaveChannelUseCase } from '../../application/leave-channel.usecase';
import { ManageQueueUseCase } from '../../application/manage-queue.usecase';
import { PlayMusicUseCase } from '../../application/play-music.usecase';
import { SearchVideoUseCase } from '../../application/search-video.usecase';
import { VoiceChannelInfo } from '../../domain/entities/song';
import { GuildInfraStateManager } from '../../infrastructure/discord-client/guild-infra-state.manager';
import { buildHelpEmbed, buildQueuedEmbed, buildQueueListEmbed } from '../helpers/embed.helper';

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
    private readonly searchVideoUseCase: SearchVideoUseCase,
    private readonly playMusicUseCase: PlayMusicUseCase,
    private readonly manageQueueUseCase: ManageQueueUseCase,
    private readonly leaveChannelUseCase: LeaveChannelUseCase,
    private readonly guildInfraStateManager: GuildInfraStateManager,
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
    const channelId = message.channelId;

    if (!songs.length) {
      const msg = await message.reply('No videos found');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const currentQueue = this.manageQueueUseCase.getQueue(message.guildId);
    const totalInQueue = currentQueue.length + songs.length;

    this.loggerService.info('playlistHandler', `queue length: ${totalInQueue}`);

    const reply = await message.reply({
      embeds: [
        buildQueuedEmbed(
          url,
          songs.length,
          totalInQueue,
          songs[0]?.title ?? 'Unknown',
          songs[0]?.thumbnail ?? '',
        ),
      ],
    });
    setTimeout(() => reply.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);

    await this.playMusicUseCase.play({
      guildId: message.guildId,
      songs,
      voiceChannel: voiceChannelInfo,
      channelId,
    });
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

    const currentQueue = this.manageQueueUseCase.getQueue(message.guildId);
    const totalInQueue = currentQueue.length + 1;

    this.loggerService.info('singleVidHandler', `Queue length: ${totalInQueue}`);

    const reply = await message.reply({
      embeds: [buildQueuedEmbed(url, 1, totalInQueue, song.title, song.thumbnail)],
    });
    setTimeout(() => reply.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);

    await this.playMusicUseCase.play({
      guildId: message.guildId,
      songs: [song],
      voiceChannel: voiceChannelInfo,
      channelId: message.channelId,
    });
  }

  @HandleDiscordError({ bubble: true })
  private async searchHandler(
    searchTxt: string,
    payload: Message | ChatInputCommandInteraction,
  ): Promise<void> {
    this.loggerService.info('searchHandler', 'Search detected');

    searchTxt = searchTxt.trim();
    const voiceChannel = this.getVoiceChannelFromPayload(payload);
    if (!voiceChannel || !payload.guildId) return;

    const voiceChannelInfo = this.toVoiceChannelInfo(voiceChannel, payload.guildId);
    const { songs } = await this.searchVideoUseCase.searchByQuery({
      query: searchTxt,
      voiceChannel: voiceChannelInfo,
      limit: 10,
    });

    const list: SelectListItem[] = songs.map((item) => ({
      label: item.title.slice(0, 100),
      description: item.url.slice(0, 100),
      value: item.url,
    }));

    const selectList = await payload.reply({
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

    const replyMessage: Message =
      selectList instanceof Message
        ? selectList
        : await (payload as ChatInputCommandInteraction).fetchReply();

    this.guildInfraStateManager.addToDeleteQueue(payload.guildId ?? '', replyMessage);
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

    const playlistCheck =
      content.match(/^(?!.*\?.*\bv=)https:\/\/(www\.)?youtube\.com\/.*\?.*\blist=.*$/) ||
      content.match(/https:\/\/music\.youtube\.com\/playlist\?list=.*/);
    const vidSongCheck =
      content.match(/https:\/\/(www\.)?youtube\.com\/watch\?v=.*/) ||
      content.match(/https:\/\/youtu\.be\/.*/) ||
      content.match(/https:\/\/music\.youtube\.com\/watch\?v=.*/);

    if (playlistCheck) await this.playlistHandler(content, voiceChannel, payload);
    else if (vidSongCheck) await this.singleVidHandler(content, voiceChannel, payload);
    else await this.searchHandler(content, payload);
  }

  @HandleDiscordError()
  public async emptyQueue(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!this.getVoiceChannelFromPayload(payload)) {
      const msg = await payload.reply('You have to be in a voice channel to clear queue music');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    const queue = this.manageQueueUseCase.getQueue(payload.guildId);
    if (queue.length === 0) {
      const msg = await payload.reply('Queue is empty');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    this.manageQueueUseCase.clearQueue(payload.guildId);

    const msg = await payload.reply('queue cleared');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async help(payload: Message | ChatInputCommandInteraction): Promise<void> {
    const discordConfig = this.configsService.DiscordConfig;
    const embed = buildHelpEmbed(discordConfig.commandPrefix);

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

    this.leaveChannelUseCase.execute(payload.guildId);

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

    const musicQueue = this.manageQueueUseCase.getQueue(payload.guildId);
    if (musicQueue.length <= 1) {
      const msg = await payload.reply('Queue is empty');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const embed = buildQueueListEmbed(musicQueue);

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

    if (payload instanceof ChatInputCommandInteraction) {
      await payload.deferReply();
    }

    this.loggerService.verbose('skip', 'Skipping song...');

    const voiceChannel = this.getVoiceChannelFromPayload(payload)!;
    const voiceChannelInfo = this.toVoiceChannelInfo(voiceChannel, payload.guildId);

    const result = await this.playMusicUseCase.skip(
      payload.guildId,
      voiceChannelInfo,
      payload.channelId,
    );

    if (result.queueEmpty) {
      const msg =
        payload instanceof ChatInputCommandInteraction
          ? await payload.editReply('Nothing to play')
          : await payload.reply('Nothing to play');
      setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
      return;
    }

    const msg =
      payload instanceof ChatInputCommandInteraction
        ? await payload.editReply('Skipping ...')
        : await payload.reply('Skipping ...');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }

  @HandleDiscordError()
  public async shuffle(payload: Message | ChatInputCommandInteraction): Promise<void> {
    if (!payload.guildId) throw new DiscordException('guild is not specified', 'command');

    this.manageQueueUseCase.shuffle(payload.guildId);

    const msg = await payload.reply('Queue shuffled');
    setTimeout(() => msg.delete(), this.configsService.DiscordConfig.messageDeleteTimeout);
  }
}
