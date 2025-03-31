import { Env } from '@app/core/constants/app.constant';
import { Algorithm } from 'jsonwebtoken';
import { tags } from 'typia';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';

export interface IApp {
  env: Env;
  port: number & tags.Type<'int32'>;
  grpcPort: number & tags.Type<'int32'>;
  serviceName: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAlgorithm: Algorithm;
  jwtExpire: number & tags.Type<'int32'> & tags.Minimum<0>;
  jwtRefreshExpire: number & tags.Type<'int32'> & tags.Minimum<0>;
  jwtIssuer: string;
  clientURI: string;
}

export interface IDatabase {
  host: string;
  port: number & tags.Type<'int32'>;
  user: string;
  password: string;
  dbName: string;
}

export type Configs = {
  [AppConfigKey]: IApp;
  [DatabaseConfigKey]: IDatabase;
};

export interface IConfigsService {
  get All(): Configs;
  get AppConfig(): IApp;
  get DatabaseConfig(): IDatabase;
}
