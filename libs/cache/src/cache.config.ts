import { getEnv, getEnvInt } from '@app/core/configs/configs.helper';
import { registerAs } from '@nestjs/config';
import { assert } from 'typia';
import { CacheConfigKey } from './cache.constant';
import { ICacheConfig } from './cache.interface';

export const CacheConfig = registerAs(CacheConfigKey, (): ICacheConfig => {
  const config: ICacheConfig = {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD', undefined),
    db: getEnvInt('REDIS_DB', 0),
    keyPrefix: getEnv('REDIS_KEY_PREFIX', undefined),
  };

  return assert<ICacheConfig>(config);
});
