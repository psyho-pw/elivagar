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
    console.log('[CacheService] Constructor called');
    // Register with lifecycle manager if available (medium priority)
    this.connectionRegistry?.register(this, {
      shutdownPriority: 10,
      required: true,
    });
    console.log('[CacheService] Registered with connection registry');
  }

  get state(): ConnectionState {
    return this._state;
  }

  async onModuleInit(): Promise<void> {
    console.log('[CacheService] onModuleInit called');
    await this.connect();
    console.log('[CacheService] onModuleInit completed');
  }

  async onModuleDestroy(): Promise<void> {
    // Fallback: disconnect if not already handled by ShutdownManager
    if (this._state !== ConnectionState.DISCONNECTED) {
      await this.disconnect();
    }
  }

  async connect(): Promise<void> {
    console.log('[CacheService] connect() called, current state:', this._state);
    if (this._state === ConnectionState.CONNECTED || this._state === ConnectionState.CONNECTING) {
      console.log('[CacheService] Already connected or connecting, skipping');
      return;
    }

    this._state = ConnectionState.CONNECTING;
    this.logger.log('Connecting to cache (Redis)...');

    try {
      // Verify connection by performing a simple cache operation
      const testKey = '__connection_test__';
      console.log('[CacheService] Testing cache.set...');
      await this.cache.set(testKey, 'ok', 1000);
      console.log('[CacheService] cache.set completed');
      console.log('[CacheService] Testing cache.del...');
      await this.cache.del(testKey);
      console.log('[CacheService] cache.del completed');

      this._state = ConnectionState.CONNECTED;
      this.connectionRegistry?.emitStateChange(this.connectionName, this._state);
      this.logger.log('✅ connected to cache (Redis)');
    } catch (error) {
      console.log('[CacheService] connect() error:', error);
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
    // For pattern-based deletion, we need to access the raw client
    // This requires the keyv store to expose the client
    const store = this.keyvRedis as unknown as { client?: { scanIterator?: Function } };
    if (!store.client?.scanIterator) {
      this.logger.warn('delByPattern: Redis client not available, skipping');
      return 0;
    }

    let count = 0;
    for await (const keys of store.client.scanIterator({ MATCH: pattern })) {
      if (typeof keys === 'string') {
        await this.cache.del(keys);
        count++;
      } else if (Array.isArray(keys) && keys.length > 0) {
        for (const key of keys) {
          await this.cache.del(key);
        }
        count += keys.length;
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

  // Sorted set operations - requires raw Redis client access
  // These will only work if the KeyvRedis exposes its client

  async zAdd(key: string, score: number, member: string): Promise<number> {
    const store = this.keyvRedis as unknown as { client?: { zAdd?: Function } };
    if (!store.client?.zAdd) {
      throw new Error('zAdd: Redis client not available');
    }
    return await store.client.zAdd(key, { score, value: member });
  }

  async zRevRank(key: string, member: string): Promise<number | null> {
    const store = this.keyvRedis as unknown as { client?: { zRevRank?: Function } };
    if (!store.client?.zRevRank) {
      throw new Error('zRevRank: Redis client not available');
    }
    const rank = await store.client.zRevRank(key, member);
    return rank !== null && typeof rank === 'number' ? rank + 1 : null;
  }

  async zCard(key: string): Promise<number> {
    const store = this.keyvRedis as unknown as { client?: { zCard?: Function } };
    if (!store.client?.zCard) {
      throw new Error('zCard: Redis client not available');
    }
    return await store.client.zCard(key);
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
