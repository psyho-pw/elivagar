import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv } from '../configs.helper';
import { IYoutubeConfig } from '../configs.interface';

export const YoutubeConfigKey = 'Youtube';

export const YoutubeConfigSchema = z.object({
  youtubeApiKey: z.string().min(1),
  cookie: z.string().optional(),
  identityToken: z.string().optional(),
  proxy: z.string().optional(),
}) satisfies z.ZodType<IYoutubeConfig>;

export const YoutubeConfig = registerAs(YoutubeConfigKey, (): IYoutubeConfig => {
  const config: IYoutubeConfig = {
    youtubeApiKey: getEnv('YOUTUBE_API_KEY'),
    cookie: getEnv('YOUTUBE_COOKIE') || undefined,
    identityToken: getEnv('YOUTUBE_IDENTITY_TOKEN') || undefined,
    proxy: getEnv('PROXY') || undefined,
  };

  return YoutubeConfigSchema.parse(config);
});
