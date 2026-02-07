import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { LoggerService } from '@app/core/logger/logger.service';
import { Inject, Injectable } from '@nestjs/common';
import {
  Channel,
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  Interaction,
  Message,
  Snowflake,
  StringSelectMenuInteraction,
  VoiceState,
} from 'discord.js';
import { WithDiscordContext } from '../../../common/aop/discord-context.aspect';
import { HandleDiscordError } from '../../../common/aop/discord-error.aspect';
import { DiscordException } from '../../../common/exceptions/discord.exception';
import { HandleVoiceStateUseCase } from '../../application/handle-voice-state.usecase';
import { PlayMusicUseCase } from '../../application/play-music.usecase';
import { SearchVideoUseCase } from '../../application/search-video.usecase';
import { VoiceChannelInfo } from '../../domain/entities/song';
import { DiscordClientAdapter } from '../../infrastructure/discord-client/discord-client.adapter';
import { GuildInfraStateManager } from '../../infrastructure/discord-client/guild-infra-state.manager';
import { buildQueuedEmbed } from '../helpers/embed.helper';

@Injectable()
export class EventHandler {
  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
    private readonly discordClient: DiscordClientAdapter,
    private readonly searchVideoUseCase: SearchVideoUseCase,
    private readonly playMusicUseCase: PlayMusicUseCase,
    private readonly handleVoiceStateUseCase: HandleVoiceStateUseCase,
    private readonly guildInfraStateManager: GuildInfraStateManager,
    private readonly loggerService: LoggerService,
  ) {}

  @WithDiscordContext()
  @HandleDiscordError()
  public async ready(_client: Client): Promise<void> {
    this.loggerService.verbose('ready', `Logged in as ${this.discordClient.getUser()}`);
    this.loggerService.verbose('ready', 'SayhoBot server ready');
  }

  @WithDiscordContext()
  @HandleDiscordError()
  private async commandHandler(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.discordClient.commands.get(interaction.commandName);
    if (!command) return;

    this.loggerService.info(
      'commandHandler',
      `request:: command: ${interaction.commandName}, user: ${interaction.user.tag}`,
    );

    try {
      await command(interaction);
    } catch (err) {
      if (err instanceof Error) {
        this.loggerService.error('commandHandler', err, err.message);
      }
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  }

  @WithDiscordContext()
  @HandleDiscordError()
  private async selectMenuHandler(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectedUrl = interaction.values[0];
    const guild: Guild | undefined = this.discordClient
      .getClient()
      .guilds.cache.get(interaction.guildId ?? '');
    const member: GuildMember | undefined = guild?.members.cache.get(
      interaction.member?.user.id as Snowflake,
    );

    if (!guild) throw new DiscordException('guild is not specified', 'event');
    if (!member?.voice.channel) {
      await interaction.reply('Cannot find channel');
      return;
    }

    await interaction.deferReply();

    const voiceChannelInfo: VoiceChannelInfo = {
      id: member.voice.channel.id,
      guildId: guild.id,
      name: member.voice.channel.name,
    };

    const song = await this.searchVideoUseCase.getByUrl(selectedUrl, voiceChannelInfo);
    if (!song) {
      await interaction.editReply('Video is either private or it does not exist');
      return;
    }

    const result = await this.playMusicUseCase.play({
      guildId: guild.id,
      songs: [song],
      voiceChannel: voiceChannelInfo,
      channelId: interaction.channelId,
    });

    this.loggerService.info(this.selectMenuHandler.name, `${song.title} added to queue`);
    this.loggerService.info(this.selectMenuHandler.name, `queue length: ${result.totalInQueue}`);

    const reply = await interaction.editReply({
      embeds: [buildQueuedEmbed(selectedUrl, 1, result.totalInQueue, song.title, song.thumbnail)],
    });
    setTimeout(() => reply.delete(), this.configsService.DiscordConfig!.messageDeleteTimeout);
    this.guildInfraStateManager.removeFromDeleteQueue(guild.id, interaction.message.id);
  }

  @WithDiscordContext()
  @HandleDiscordError()
  public async interactionCreate(interaction: Interaction): Promise<void> {
    if (interaction.isStringSelectMenu()) {
      await this.selectMenuHandler(interaction);
    } else if (interaction.isChatInputCommand()) {
      await this.commandHandler(interaction);
    }
  }

  @WithDiscordContext()
  @HandleDiscordError()
  public async messageCreate(message: Message): Promise<void> {
    this.loggerService.info(this.messageCreate.name, `message received ${message.content}`);

    if (message.author.bot) return;

    if (!message.content.startsWith(this.configsService.DiscordConfig!.commandPrefix)) {
      this.loggerService.verbose(
        this.messageCreate.name,
        `doesn't match prefix '${this.configsService.DiscordConfig!.commandPrefix}' skipping...`,
      );
      return;
    }

    const args = message.content
      .slice(this.configsService.DiscordConfig!.commandPrefix.length)
      .trim()
      .split(/ +/g);
    const commandName = args.shift()?.toLowerCase() ?? '';

    this.loggerService.info(this.messageCreate.name, `command: ${commandName}`);

    const command = this.discordClient.commands.get(commandName);
    if (!command) {
      this.loggerService.error(this.messageCreate.name, `command ${commandName} does not exist`);
      return;
    }

    try {
      await command(message);
      await message.delete();
    } catch (err) {
      await message.reply({ content: 'There was an error while executing this command' });
      throw err;
    }
  }

  @WithDiscordContext()
  @HandleDiscordError()
  public async voiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (oldState.channelId !== (oldState.guild.members.me?.voice.channelId || newState.channel)) {
      return;
    }

    if (!((oldState.channel?.members.size ?? 1) - 1)) {
      setTimeout(() => {
        if (!((oldState.channel?.members.size ?? 1) - 1)) {
          const channel = oldState.client.channels.cache
            .filter((ch: Channel) => {
              if (!ch.isTextBased() || ch.isDMBased()) return false;
              const guildChannel = ch as Channel & { guildId?: string; name?: string };
              return guildChannel.guildId === oldState.guild.id && guildChannel.name === '일반';
            })
            .first() as (Channel & { id: string }) | undefined;

          if (channel) {
            this.handleVoiceStateUseCase.handleBotAlone(newState.guild.id, channel.id);
          }
        }
      }, 5000);
    }
  }
}
