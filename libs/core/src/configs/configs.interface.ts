import { Env } from '@app/core/constants/app.constant';
import { Algorithm } from 'jsonwebtoken';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';

export interface IApp {
  env: Env;
  port: number;
  grpcPort: number;
  serviceName: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAlgorithm: Algorithm;
  jwtExpire: number;
  jwtRefreshExpire: number;
  jwtIssuer: string;
  clientURI: string;
}

export interface IDatabase {
  host: string;
  port: number;
  user: string;
  password: string;
  dbName: string;
}

export interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface IKafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  ssl: boolean;
  saslMechanism?: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  saslUsername?: string;
  saslPassword?: string;
  connectionTimeout?: number;
  requestTimeout?: number;
}

export interface IDiscordConfig {
  token: string;
  clientId: string;
  guildId: string;
  commandPrefix: string;
  messageDeleteTimeout: number;
}

export interface IDiscordWebhookConfig {
  webhookUrl: string;
}

export interface IYoutubeConfig {
  youtubeApiKey: string;
  cookie?: string;
  identityToken?: string;
  proxy?: string;
}

export interface IAuthGrpcConfig {
  url: string;
}

export type CoreConfigs = {
  [AppConfigKey]: IApp;
  [DatabaseConfigKey]: IDatabase;
};

export interface IConfigsService {
  get AppConfig(): IApp;
  get DatabaseConfig(): IDatabase;
}
