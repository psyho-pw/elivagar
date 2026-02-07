import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv, getEnvInt } from '../configs.helper';
import { IDiscordConfig } from '../configs.interface';

export const DiscordConfigKey = 'Discord';

export const DiscordConfigSchema = z.object({
  token: z.string().min(1),
  clientId: z.string().min(1),
  guildId: z.string().min(1),
  commandPrefix: z.string().min(1),
  messageDeleteTimeout: z.number(),
}) satisfies z.ZodType<IDiscordConfig>;

export const DiscordConfig = registerAs(DiscordConfigKey, (): IDiscordConfig => {
  const config: IDiscordConfig = {
    token: getEnv('DISCORD_TOKEN'),
    clientId: getEnv('DISCORD_CLIENT_ID'),
    guildId: getEnv('DISCORD_GUILD_ID'),
    commandPrefix: getEnv('DISCORD_COMMAND_PREFIX', '!'),
    messageDeleteTimeout: getEnvInt('DISCORD_MESSAGE_DELETE_TIMEOUT', 7000),
  };

  return DiscordConfigSchema.parse(config);
});
