import { getEnv, getEnvInt } from '@app/core/configs/configs.helper';
import { registerAs } from '@nestjs/config';
import { assert } from 'typia';
import { RedisConfigKey } from './redis.constant';
import { IRedisConfig } from './redis.interface';

export const RedisConfig = registerAs(RedisConfigKey, (): IRedisConfig => {
  const config: IRedisConfig = {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD', undefined),
    db: getEnvInt('REDIS_DB', 0),
    keyPrefix: getEnv('REDIS_KEY_PREFIX', undefined),
  };

  return assert<IRedisConfig>(config);
});
