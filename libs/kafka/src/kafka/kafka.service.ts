import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaClientKey } from './kafka.constant';
import { IKafkaService } from './kafka.interface';

@Injectable()
export class KafkaService implements IKafkaService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(@Inject(KafkaClientKey) private readonly kafkaClient: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
    this.logger.log('Kafka client connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
    this.logger.log('Kafka client disconnected');
  }

  emit<T>(topic: string, message: T): void {
    this.kafkaClient.emit(topic, {
      value: JSON.stringify(message),
      timestamp: Date.now().toString(),
    });
    this.logger.debug(`Message emitted to topic: ${topic}`);
  }

  emitWithKey<T>(topic: string, key: string, message: T): void {
    this.kafkaClient.emit(topic, {
      key,
      value: JSON.stringify(message),
      timestamp: Date.now().toString(),
    });
    this.logger.debug(`Message emitted to topic: ${topic} with key: ${key}`);
  }
}
