import { Env } from '@app/core/constants/app.constant';
import { Algorithm } from 'jsonwebtoken';
import { tags } from 'typia';
import { AppConfigKey } from './configurations/app.config';
import { AuthGrpcConfigKey } from './configurations/auth-grpc.config';
import { DatabaseConfigKey } from './configurations/database.config';
import { DiscordConfigKey } from './configurations/discord.config';
import { KafkaConfigKey } from './configurations/kafka.config';
import { RedisConfigKey } from './configurations/redis.config';
import { YoutubeConfigKey } from './configurations/youtube.config';

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
  connectionTimeout?: number & tags.Type<'int32'> & tags.Minimum<0>;
  requestTimeout?: number & tags.Type<'int32'> & tags.Minimum<0>;
}

export interface IDiscordConfig {
  token: string;
  clientId: string;
  guildId: string;
  commandPrefix: string;
  messageDeleteTimeout: number;
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

// Core configs (required for all services)
export type CoreConfigs = {
  [AppConfigKey]: IApp;
  [DatabaseConfigKey]: IDatabase;
};

// All possible configs (for ConfigService type inference)
export type Configs = CoreConfigs & {
  [RedisConfigKey]?: IRedisConfig;
  [KafkaConfigKey]?: IKafkaConfig;
  [DiscordConfigKey]?: IDiscordConfig;
  [YoutubeConfigKey]?: IYoutubeConfig;
  [AuthGrpcConfigKey]?: IAuthGrpcConfig;
};

export interface IConfigsService {
  get AppConfig(): IApp;
  get DatabaseConfig(): IDatabase;
  get RedisConfig(): IRedisConfig;
  get KafkaConfig(): IKafkaConfig;
  get DiscordConfig(): IDiscordConfig;
  get YoutubeConfig(): IYoutubeConfig;
  get AuthGrpcConfig(): IAuthGrpcConfig;
}
