import { tags } from 'typia';

export interface KafkaModuleOptions {
  clientId?: string;
  groupId?: string;
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

export interface IKafkaService {
  emit<T>(topic: string, message: T): void;
  emitWithKey<T>(topic: string, key: string, message: T): void;
}
