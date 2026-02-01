import { registerAs } from '@nestjs/config';
import { IValidation, validate } from 'typia';
import { IDatabase } from '../configs.interface';
import { getEnv, getEnvInt } from '../env.helper';

export const DatabaseConfigKey = 'Database';

export const DatabaseConfig = registerAs(DatabaseConfigKey, (): IDatabase => {
  const config = {
    host: getEnv('DB_HOST'),
    port: getEnvInt('DB_PORT', 5432),
    user: getEnv('DB_USERNAME'),
    password: getEnv('DB_PASSWORD'),
    dbName: getEnv('DB_DATABASE'),
  };

  const res: IValidation<IDatabase> = validate<IDatabase>(config);

  if (!res.success) {
    console.error(res.errors);
    throw new Error(DatabaseConfigKey);
  }

  return res.data;
});
