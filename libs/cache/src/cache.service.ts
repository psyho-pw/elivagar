import { ConnectionRegistryService } from '@app/core/lifecycle/connection-registry.service';
import { ConnectionNames } from '@app/core/lifecycle/lifecycle.constant';
import { ConnectionState, IManagedConnection } from '@app/core/lifecycle/lifecycle.interface';
import KeyvRedis from '@keyv/redis';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { RedisClientType } from '@redis/client';
import { instanceToPlain } from 'class-transformer';
import { KeyvRedisKey } from './cache.constant';
import { ICacheService } from './cache.interface';

@Injectable()
export class CacheService
  implements ICacheService, IManagedConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CacheService.name);
  private _state: ConnectionState = ConnectionState.DISCONNECTED;

  // Single-flight map for coalescing concurrent requests
  private readonly inflightRequests = new Map<string, Promise<unknown>>();

  readonly connectionName = ConnectionNames.REDIS;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(KeyvRedisKey) private readonly keyvRedis: KeyvRedis<string>,
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
    if (this._state !== ConnectionState.DISCONNECTED) {
      await this.disconnect();
    }
  }

  async connect(): Promise<void> {
    if (this._state === ConnectionState.CONNECTED || this._state === ConnectionState.CONNECTING) {
      return;
    }

    this._state = ConnectionState.CONNECTING;

    try {
      // Verify connection by performing a simple cache operation
      const testKey = '__connection_test__';
      await this.cache.set(testKey, 'ok', 1000);
      await this.cache.del(testKey);

      this._state = ConnectionState.CONNECTED;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.log('✅ connected to cache (Redis)');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.error('Failed to connect to cache', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === ConnectionState.DISCONNECTED) {
      return;
    }

    this._state = ConnectionState.DISCONNECTING;
    this.logger.log('Disconnecting from cache...');

    try {
      await this.keyvRedis.disconnect();
      this._state = ConnectionState.DISCONNECTED;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.log('Disconnected from cache');
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
      const testKey = '__health_check__';
      await this.cache.set(testKey, 'ok', 1000);
      await this.cache.del(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get raw Redis client for operations not supported by cache-manager
   * @throws Error if Redis client is not available
   */
  getClient(): RedisClientType {
    if (this.keyvRedis && 'client' in this.keyvRedis) {
      return this.keyvRedis.client as RedisClientType;
    }
    throw new Error('Redis client not available');
  }

  // ICacheService implementation

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.cache.get<T>(key);
    return result === null ? undefined : result;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cache.set(key, instanceToPlain(value), ttl);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    const client = this.getClient();

    let count = 0;
    for await (const keys of client.scanIterator({ MATCH: pattern })) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      for (const key of keyArray) {
        await this.cache.del(key);
        count++;
      }
    }

    return count;
  }

  async clear(): Promise<void> {
    // Access the underlying stores to clear them
    const cacheWithStores = this.cache as unknown as {
      stores?: Array<{ clear?: () => Promise<void> }>;
    };
    if (cacheWithStores.stores) {
      await Promise.all(cacheWithStores.stores.map((store) => store.clear?.()));
    }
  }

  // Sorted set operations - requires raw Redis client

  async zAdd(key: string, score: number, member: string): Promise<number> {
    const client = this.getClient();
    return await client.zAdd(key, { score, value: member });
  }

  async zRevRank(key: string, member: string): Promise<number | null> {
    const client = this.getClient();
    const rank = await client.zRevRank(key, member);
    return rank !== null ? rank + 1 : null;
  }

  async zCard(key: string): Promise<number> {
    const client = this.getClient();
    return await client.zCard(key);
  }

  // Single-flight/coalescing wrapper

  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      this.logger.verbose?.(`cache hit: ${key}`);
      return cached;
    }

    // Check if there's an in-flight request
    const inflight = this.inflightRequests.get(key);
    if (inflight) {
      this.logger.verbose?.(`single-flight: joining existing request for ${key}`);
      return inflight as Promise<T>;
    }

    // Create new request with single-flight pattern
    const promise = (async (): Promise<T> => {
      try {
        const result = await fn();
        await this.set(key, result, ttl);
        return result;
      } finally {
        this.inflightRequests.delete(key);
      }
    })();

    this.inflightRequests.set(key, promise);
    return promise;
  }
}
