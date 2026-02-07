import { IKafkaConfig } from '@app/core/configs/configs.interface';
import { ConfigsService } from '@app/core/configs/configs.service';
import { ModuleMetadata, Type } from '@nestjs/common';

export interface KafkaModuleOptions {
  /** Kafka connection configuration (required) */
  kafka: IKafkaConfig;
  /** Override clientId from config */
  clientId?: string;
  /** Override groupId from config */
  groupId?: string;
}

export interface KafkaModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (configsService: ConfigsService) => KafkaModuleOptions | Promise<KafkaModuleOptions>;
  inject?: (Type | string | symbol)[];
}

export interface IKafkaService {
  emit<T>(topic: string, message: T): void;
  emitWithKey<T>(topic: string, key: string, message: T): void;
}
