import { Env } from '@app/core/constants/app.constant';
import { Algorithm } from 'jsonwebtoken';
import { tags } from 'typia';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';
import { KafkaConfigKey } from './configurations/kafka.config';
import { RedisConfigKey } from './configurations/redis.config';

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

// Core configs (required for all services)
export type CoreConfigs = {
  [AppConfigKey]: IApp;
  [DatabaseConfigKey]: IDatabase;
};

// All possible configs (for ConfigService type inference)
export type Configs = CoreConfigs & {
  [RedisConfigKey]?: IRedisConfig;
  [KafkaConfigKey]?: IKafkaConfig;
};

export interface IConfigsService {
  get AppConfig(): IApp;
  get DatabaseConfig(): IDatabase;
  get RedisConfig(): IRedisConfig;
  get KafkaConfig(): IKafkaConfig;
}
