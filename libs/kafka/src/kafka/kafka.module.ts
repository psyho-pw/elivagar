import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, KafkaOptions, Transport } from '@nestjs/microservices';
import { SASLOptions } from 'kafkajs';
import { KafkaConfig, KafkaConfigKey } from './kafka.config';
import { KafkaClientKey, KafkaServiceKey } from './kafka.constant';
import { IKafkaConfig, KafkaModuleOptions } from './kafka.interface';
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

  private static makeKafkaOptions(
    kafkaConfig: IKafkaConfig,
    options: KafkaModuleOptions = {},
  ): KafkaOptions {
    const sasl = this.makeSaslConfig(kafkaConfig);

    return {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: options.clientId ?? kafkaConfig.clientId,
          brokers: kafkaConfig.brokers,
          ssl: kafkaConfig.ssl,
          connectionTimeout: kafkaConfig.connectionTimeout,
          requestTimeout: kafkaConfig.requestTimeout,
          ...(sasl && { sasl }),
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
              return this.makeKafkaOptions(kafkaConfig, options);
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
    return this.makeKafkaOptions(kafkaConfig, options);
  }
}
