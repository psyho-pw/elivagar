import { Env } from '@app/core/constants/app.constant';
import { Algorithm } from 'jsonwebtoken';
import { tags } from 'typia';

export interface IApp {
  env: Env;
  port: number & tags.Type<'int32'>;
  serviceName: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAlgorithm: Algorithm;
  jwtExpire: number & tags.Type<'int32'> & tags.Minimum<0>;
  jwtRefreshExpire: number & tags.Type<'int32'> & tags.Minimum<0>;
  jwtIssuer: string;
  clientURI: string;
}

export type Configs = {
  App: IApp;
};

export interface IConfigsService {
  get All(): Configs;
  get AppConfig(): IApp;
}
