import { registerAs } from '@nestjs/config';
import { assert } from 'typia';
import { getEnv } from '../configs.helper';
import { IYoutubeConfig } from '../configs.interface';

export const YoutubeConfigKey = 'Youtube';

export const YoutubeConfig = registerAs(YoutubeConfigKey, (): IYoutubeConfig => {
  const config: IYoutubeConfig = {
    youtubeApiKey: getEnv('YOUTUBE_API_KEY'),
    cookie: getEnv('YOUTUBE_COOKIE') || undefined,
    identityToken: getEnv('YOUTUBE_IDENTITY_TOKEN') || undefined,
    proxy: getEnv('PROXY') || undefined,
  };

  return assert<IYoutubeConfig>(config);
});
