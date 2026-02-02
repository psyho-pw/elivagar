import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, KafkaOptions, Transport } from '@nestjs/microservices';
import { KafkaConfig, KafkaConfigKey } from './kafka.config';
import { KafkaClientKey, KafkaServiceKey } from './kafka.constant';
import { IKafkaConfig, KafkaModuleOptions } from './kafka.interface';
import { KafkaService } from './kafka.service';

@Module({})
export class KafkaModule {
  private static buildKafkaOptions(
    kafkaConfig: IKafkaConfig,
    options: KafkaModuleOptions = {},
  ): KafkaOptions {
    return {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: options.clientId ?? kafkaConfig.clientId,
          brokers: kafkaConfig.brokers,
          ssl: kafkaConfig.ssl,
          connectionTimeout: kafkaConfig.connectionTimeout,
          requestTimeout: kafkaConfig.requestTimeout,
          ...(kafkaConfig.saslUsername &&
            kafkaConfig.saslPassword &&
            kafkaConfig.saslMechanism === 'plain' && {
              sasl: {
                mechanism: 'plain' as const,
                username: kafkaConfig.saslUsername,
                password: kafkaConfig.saslPassword,
              },
            }),
          ...(kafkaConfig.saslUsername &&
            kafkaConfig.saslPassword &&
            kafkaConfig.saslMechanism === 'scram-sha-256' && {
              sasl: {
                mechanism: 'scram-sha-256' as const,
                username: kafkaConfig.saslUsername,
                password: kafkaConfig.saslPassword,
              },
            }),
          ...(kafkaConfig.saslUsername &&
            kafkaConfig.saslPassword &&
            kafkaConfig.saslMechanism === 'scram-sha-512' && {
              sasl: {
                mechanism: 'scram-sha-512' as const,
                username: kafkaConfig.saslUsername,
                password: kafkaConfig.saslPassword,
              },
            }),
        },
        consumer: {
          groupId: options.groupId ?? kafkaConfig.groupId,
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
   */
  static register(options: KafkaModuleOptions = {}): DynamicModule {
    return {
      module: KafkaModule,
      imports: [
        ConfigModule.forFeature(KafkaConfig),
        ClientsModule.registerAsync([
          {
            name: KafkaClientKey,
            imports: [ConfigModule.forFeature(KafkaConfig)],
            useFactory: (configService: ConfigService): KafkaOptions => {
              const kafkaConfig = configService.get<IKafkaConfig>(KafkaConfigKey)!;
              return this.buildKafkaOptions(kafkaConfig, options);
            },
            inject: [ConfigService],
          },
        ]),
      ],
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
   * Get Kafka microservice options for NestFactory.createMicroservice()
   * Use this in main.ts to connect as a consumer
   */
  static getConsumerOptions(
    kafkaConfig: IKafkaConfig,
    options: KafkaModuleOptions = {},
  ): KafkaOptions {
    return this.buildKafkaOptions(kafkaConfig, options);
  }
}
