import { IKafkaConfig } from '@app/core/configs/configs.interface';
import { ConfigsService } from '@app/core/configs/configs.service';
import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, KafkaOptions, Transport } from '@nestjs/microservices';
import { SASLOptions } from 'kafkajs';
import { KafkaClientKey, KafkaServiceKey } from './kafka.constant';
import { KafkaModuleAsyncOptions, KafkaModuleOptions } from './kafka.interface';
import { KafkaService } from './kafka.service';

@Module({})
export class KafkaModule {
  private static makeSaslConfig(kafkaConfig: IKafkaConfig): SASLOptions | undefined {
    const { saslUsername, saslPassword, saslMechanism } = kafkaConfig;
    if (!saslUsername || !saslPassword || !saslMechanism) {
      return undefined;
    }

    return {
      mechanism: saslMechanism,
      username: saslUsername,
      password: saslPassword,
    } as SASLOptions;
  }

  private static makeKafkaOptions(options: KafkaModuleOptions): KafkaOptions {
    const { kafka } = options;
    const sasl = this.makeSaslConfig(kafka);

    return {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: options.clientId ?? kafka.clientId,
          brokers: kafka.brokers,
          ssl: kafka.ssl,
          connectionTimeout: kafka.connectionTimeout,
          requestTimeout: kafka.requestTimeout,
          ...(sasl && { sasl }),
        },
        consumer: {
          groupId: options.groupId ?? kafka.groupId,
          allowAutoTopicCreation: true,
        },
        producer: {
          allowAutoTopicCreation: true,
        },
      },
    };
  }

  /**
   * Register Kafka module for producer usage
   * Use this in AppModule imports for services that need to publish events
   *
   * @param options.kafka - Kafka connection configuration (required)
   * @param options.clientId - Override clientId from config
   * @param options.groupId - Override groupId from config
   */
  static register(options: KafkaModuleOptions): DynamicModule {
    const kafkaOptions = this.makeKafkaOptions(options);

    return {
      module: KafkaModule,
      global: true,
      imports: [ClientsModule.register([{ name: KafkaClientKey, ...kafkaOptions }])],
      providers: [
        {
          provide: KafkaServiceKey,
          useClass: KafkaService,
        },
      ],
      exports: [KafkaServiceKey, ClientsModule],
    };
  }

  /**
   * Register Kafka module asynchronously with dependency injection
   *
   * @param asyncOptions.imports - Modules to import (e.g., ConfigModule)
   * @param asyncOptions.useFactory - Factory function returning KafkaModuleOptions
   * @param asyncOptions.inject - Dependencies to inject into factory
   */
  static registerAsync(asyncOptions: KafkaModuleAsyncOptions): DynamicModule {
    return {
      module: KafkaModule,
      global: true,
      imports: [
        ...(asyncOptions.imports ?? []),
        ClientsModule.registerAsync([
          {
            name: KafkaClientKey,
            useFactory: async (configsService: ConfigsService): Promise<KafkaOptions> => {
              const options = await asyncOptions.useFactory(configsService);
              return this.makeKafkaOptions(options);
            },
            inject: asyncOptions.inject ?? [],
          },
        ]),
      ],
      providers: [{ provide: KafkaServiceKey, useClass: KafkaService }],
      exports: [KafkaServiceKey, ClientsModule],
    };
  }

  /**
   * Get Kafka microservice options for NestFactory.createMicroservice()
   * Use this in main.ts to connect as a consumer
   */
  static getConsumerOptions(options: KafkaModuleOptions): KafkaOptions {
    return this.makeKafkaOptions(options);
  }
}
