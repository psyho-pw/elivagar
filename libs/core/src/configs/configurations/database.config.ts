import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv, getEnvInt } from '../configs.helper';
import { IDatabase } from '../configs.interface';

export const DatabaseConfigKey = 'Database';

export const DatabaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int(),
  user: z.string().min(1),
  password: z.string().min(1),
  dbName: z.string().min(1),
}) satisfies z.ZodType<IDatabase>;

export const DatabaseConfig = registerAs(DatabaseConfigKey, (): IDatabase => {
  const config = {
    host: getEnv('DB_HOST'),
    port: getEnvInt('DB_PORT', 5432),
    user: getEnv('DB_USERNAME'),
    password: getEnv('DB_PASSWORD'),
    dbName: getEnv('DB_DATABASE'),
  };

  const res = DatabaseConfigSchema.safeParse(config);

  if (!res.success) {
    console.error(res.error.issues);
    throw new Error(DatabaseConfigKey);
  }

  return res.data;
});
