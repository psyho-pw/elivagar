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
import Redis from 'ioredis';
import { RedisClientKey } from './redis.constant';
import { IRedisService } from './redis.interface';

@Injectable()
export class RedisService
  implements IRedisService, IManagedConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);
  private _state: ConnectionState = ConnectionState.DISCONNECTED;

  readonly connectionName = ConnectionNames.REDIS;

  constructor(
    @Inject(RedisClientKey) private readonly redis: Redis,
    @Optional() private readonly connectionRegistry?: ConnectionRegistryService,
  ) {
    // Register with lifecycle manager if available (medium priority)
    this.connectionRegistry?.register(this, {
      shutdownPriority: 10,
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
    if (this._state === ConnectionState.CONNECTED || this._state === ConnectionState.CONNECTING) {
      return;
    }

    this._state = ConnectionState.CONNECTING;
    this.logger.log('Connecting to redis...');

    try {
      // ioredis connects lazily, so we need to ping to verify
      await this.redis.ping();

      this._state = ConnectionState.CONNECTED;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.log('✅ connected to redis');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.error('Failed to connect to redis', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === ConnectionState.DISCONNECTED) {
      return;
    }

    this._state = ConnectionState.DISCONNECTING;
    this.logger.log('Disconnecting from redis...');

    try {
      await this.redis.quit();
      this._state = ConnectionState.DISCONNECTED;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.log('Disconnected from redis');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (this._state !== ConnectionState.CONNECTED) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // IRedisService implementation

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  // Additional helper methods

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (value === null) return null;
    return JSON.parse(value) as T;
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.redis.expire(key, seconds);
    return result === 1;
  }

  /** Get the underlying ioredis client for advanced operations */
  getClient(): Redis {
    return this.redis;
  }
}
