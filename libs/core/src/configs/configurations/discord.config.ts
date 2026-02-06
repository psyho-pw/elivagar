import { registerAs } from '@nestjs/config';
import { assert } from 'typia';
import { getEnv, getEnvInt } from '../configs.helper';
import { IDiscordConfig } from '../configs.interface';

export const DiscordConfigKey = 'Discord';

export const DiscordConfig = registerAs(DiscordConfigKey, (): IDiscordConfig => {
  const config: IDiscordConfig = {
    token: getEnv('DISCORD_TOKEN'),
    clientId: getEnv('DISCORD_CLIENT_ID'),
    guildId: getEnv('DISCORD_GUILD_ID'),
    commandPrefix: getEnv('DISCORD_COMMAND_PREFIX', '!'),
    messageDeleteTimeout: getEnvInt('DISCORD_MESSAGE_DELETE_TIMEOUT', 7000),
    webhookUrl: getEnv('DISCORD_WEBHOOK_URL'),
  };

  return assert<IDiscordConfig>(config);
});
