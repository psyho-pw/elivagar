import { ConnectionRegistryService } from '@app/core/lifecycle/connection-registry.service';
import { ConnectionNames } from '@app/core/lifecycle/lifecycle.constant';
import { ConnectionState, IManagedConnection } from '@app/core/lifecycle/lifecycle.interface';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaClientKey } from './kafka.constant';
import { IKafkaService } from './kafka.interface';

@Injectable()
export class KafkaService
  implements IKafkaService, IManagedConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaService.name);
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private pendingMessages = 0;

  readonly connectionName = ConnectionNames.KAFKA;

  constructor(
    @Inject(KafkaClientKey) private readonly kafkaClient: ClientKafka,
    @Optional() private readonly connectionRegistry?: ConnectionRegistryService,
  ) {
    // Register with lifecycle manager if available (high priority - shuts down first)
    this.connectionRegistry?.register(this, {
      shutdownPriority: 20,
      required: true,
    });
  }

  get state(): ConnectionState {
    return this._state;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    // Fallback: disconnect if not already handled by ShutdownManager
    // This ensures proper cleanup even when LifecycleModule is not imported
    if (this._state !== ConnectionState.DISCONNECTED) {
      await this.disconnect();
    }
  }

  async connect(): Promise<void> {
    if (
      this._state === ConnectionState.CONNECTED ||
      this._state === ConnectionState.CONNECTING
    ) {
      return;
    }

    this._state = ConnectionState.CONNECTING;
    this.logger.log('Connecting to kafka...');

    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.kafkaClient.connect();
        this._state = ConnectionState.CONNECTED;
        this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
        this.logger.log('✅ connected to kafka');
        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Kafka connection attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, 8s
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          await this.sleep(delay);
        }
      }
    }

    this._state = ConnectionState.ERROR;
    this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
    this.logger.error(`Failed to connect to kafka after ${maxRetries} attempts`);
    throw lastError;
  }

  async disconnect(): Promise<void> {
    if (this._state === ConnectionState.DISCONNECTED) {
      return;
    }

    this._state = ConnectionState.DISCONNECTING;
    this.logger.log('Disconnecting from kafka...');

    try {
      await this.kafkaClient.close();
      this._state = ConnectionState.DISCONNECTED;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.log('Disconnected from kafka');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this._state === ConnectionState.CONNECTED;
  }

  async drain(): Promise<void> {
    if (this.pendingMessages === 0) {
      this.logger.debug('No pending messages to drain');
      return;
    }

    const timeout = 10000;
    const startTime = Date.now();

    this.logger.log(`Draining ${this.pendingMessages} pending messages...`);

    while (this.pendingMessages > 0 && Date.now() - startTime < timeout) {
      await this.sleep(100);
    }

    if (this.pendingMessages > 0) {
      this.logger.warn(`Drain timeout reached with ${this.pendingMessages} messages still pending`);
    } else {
      this.logger.log('Kafka drain complete');
    }
  }

  emit<T>(topic: string, message: T): void {
    this.pendingMessages++;
    this.kafkaClient
      .emit(topic, {
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
      })
      .subscribe({
        complete: () => {
          this.pendingMessages--;
        },
        error: (err) => {
          this.pendingMessages--;
          this.logger.error(`Failed to emit message to topic ${topic}:`, err);
        },
      });
    this.logger.debug(`Message emitted to topic: ${topic}`);
  }

  emitWithKey<T>(topic: string, key: string, message: T): void {
    this.pendingMessages++;
    this.kafkaClient
      .emit(topic, {
        key,
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
      })
      .subscribe({
        complete: () => {
          this.pendingMessages--;
        },
        error: (err) => {
          this.pendingMessages--;
          this.logger.error(`Failed to emit message to topic ${topic} with key ${key}:`, err);
        },
      });
    this.logger.debug(`Message emitted to topic: ${topic} with key: ${key}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
