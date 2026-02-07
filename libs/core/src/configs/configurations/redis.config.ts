import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv, getEnvInt } from '../configs.helper';
import { IRedisConfig } from '../configs.interface';

export const RedisConfigKey = 'Redis';

export const RedisConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number(),
  password: z.string().optional(),
  db: z.number().optional(),
  keyPrefix: z.string().optional(),
}) satisfies z.ZodType<IRedisConfig>;

export const RedisConfig = registerAs(RedisConfigKey, (): IRedisConfig => {
  const config: IRedisConfig = {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD') || undefined,
    db: getEnvInt('REDIS_DB', 0),
    keyPrefix: getEnv('REDIS_KEY_PREFIX') || undefined,
  };

  return RedisConfigSchema.parse(config);
});
