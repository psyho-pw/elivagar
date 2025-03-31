import { registerAs } from '@nestjs/config';
import { IValidation, validate } from 'typia';
import { IDatabase } from '../configs.interface';

export const DatabaseConfigKey = 'Database';

export const DatabaseConfig = registerAs(DatabaseConfigKey, (): IDatabase => {
  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dbName: process.env.DB_DATABASE,
  };

  const res: IValidation<IDatabase> = validate<IDatabase>(config);

  if (!res.success) {
    console.error(res.errors);
    throw new Error(DatabaseConfigKey);
  }

  return res.data;
});
