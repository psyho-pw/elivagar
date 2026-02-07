import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { LoggerService } from '@app/core/logger/logger.service';
import { generateDependencyReport } from '@discordjs/voice';
import { Inject, Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  GatewayIntentBits,
  Message,
  REST,
} from 'discord.js';
import { HandleDiscordError } from '../../../common/aop/discord-error.aspect';
import { DiscordException } from '../../../common/exceptions/discord.exception';

type CommandFunction = (payload: Message | ChatInputCommandInteraction) => Promise<void>;

@Injectable()
export class DiscordClientAdapter {
  discordBotClient!: Client;
  public commands: Collection<string, CommandFunction> = new Collection();
  private rest!: REST;

  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
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
