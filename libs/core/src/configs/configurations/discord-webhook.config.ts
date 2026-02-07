import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv } from '../configs.helper';
import { IDiscordWebhookConfig } from '../configs.interface';

export const DiscordWebhookConfigKey = 'DiscordWebhook';

export const DiscordWebhookConfigSchema = z.object({
  webhookUrl: z.string().min(1),
}) satisfies z.ZodType<IDiscordWebhookConfig>;

export const DiscordWebhookConfig = registerAs(
  DiscordWebhookConfigKey,
  (): IDiscordWebhookConfig => {
    const config: IDiscordWebhookConfig = {
      webhookUrl: getEnv('DISCORD_WEBHOOK_URL'),
    };

    return DiscordWebhookConfigSchema.parse(config);
  },
);
