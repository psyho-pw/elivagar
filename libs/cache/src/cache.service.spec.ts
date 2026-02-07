jest.mock('uuid', () => ({
  v7: (): string => 'mock-uuid-v7',
}));

import { ConnectionRegistryService } from '@app/core/lifecycle/connection-registry.service';
import { ConnectionNames } from '@app/core/lifecycle/lifecycle.constant';
import { ConnectionState } from '@app/core/lifecycle/lifecycle.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TestBed, Mocked } from '@suites/unit';
import { KeyvRedisKey } from './cache.constant';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let cache: Mocked<{ get: jest.Mock; set: jest.Mock; del: jest.Mock }>;
  let keyvRedis: Mocked<{
    client: Record<string, jest.Mock>;
    disconnect: jest.Mock;
  }>;
  let connectionRegistry: Mocked<ConnectionRegistryService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(CacheService)
      .mock(CACHE_MANAGER)
      .impl(() => ({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        stores: undefined,
      }))
      .mock(KeyvRedisKey)
      .impl(() => ({
        client: {
          scanIterator: jest.fn(),
          zAdd: jest.fn(),
          zRevRank: jest.fn(),
          zCard: jest.fn(),
        },
        disconnect: jest.fn(),
      }))
      .compile();

    service = unit;
    cache = unitRef.get(CACHE_MANAGER);
    keyvRedis = unitRef.get(KeyvRedisKey);
    connectionRegistry = unitRef.get(ConnectionRegistryService);
  });

  describe('constructor', () => {
    it('should register with connection registry on construction', () => {
      expect(connectionRegistry.register).toHaveBeenCalledWith(service, {
        shutdownPriority: 10,
        required: true,
      });
    });

    it('should set initial state to DISCONNECTED', () => {
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should set connectionName to REDIS', () => {
      expect(service.connectionName).toBe(ConnectionNames.REDIS);
    });

    it('should not throw without ConnectionRegistryService (optional)', async () => {
      const { unit } = await TestBed.solitary(CacheService)
        .mock(CACHE_MANAGER)
        .impl(() => ({
          get: jest.fn(),
          set: jest.fn(),
          del: jest.fn(),
        }))
        .mock(KeyvRedisKey)
        .impl(() => ({
          client: {},
          disconnect: jest.fn(),
        }))
        .mock(ConnectionRegistryService)
        .impl(() => undefined as unknown as ConnectionRegistryService)
        .compile();

      expect(unit).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should transition from DISCONNECTED to CONNECTED on success', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);

      await service.connect();

      expect(service.state).toBe(ConnectionState.CONNECTED);
    });

    it('should emit state change on successful connect', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);

      await service.connect();

      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.REDIS,
        ConnectionState.CONNECTED,
      );
    });

    it('should verify connection by set/del test key', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);

      await service.connect();

      expect(cache.set).toHaveBeenCalledWith('__connection_test__', 'ok', 1000);
      expect(cache.del).toHaveBeenCalledWith('__connection_test__');
    });

    it('should transition to ERROR on failure', async () => {
      cache.set.mockRejectedValue(new Error('connection failed'));

      await expect(service.connect()).rejects.toThrow('connection failed');
      expect(service.state).toBe(ConnectionState.ERROR);
    });

    it('should emit state change on connect failure', async () => {
      cache.set.mockRejectedValue(new Error('connection failed'));

      await expect(service.connect()).rejects.toThrow();
      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.REDIS,
        ConnectionState.ERROR,
      );
    });

    it('should be a no-op when already CONNECTED', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);

      await service.connect();
      cache.set.mockClear();
      cache.del.mockClear();

      await service.connect();

      expect(cache.set).not.toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.CONNECTED);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);
      await service.connect();
    });

    it('should transition to DISCONNECTED on success', async () => {
      keyvRedis.disconnect.mockResolvedValue(undefined);

      await service.disconnect();

      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should emit state change on successful disconnect', async () => {
      keyvRedis.disconnect.mockResolvedValue(undefined);

      await service.disconnect();

      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.REDIS,
        ConnectionState.DISCONNECTED,
      );
    });

    it('should transition to ERROR on disconnect failure', async () => {
      keyvRedis.disconnect.mockRejectedValue(new Error('disconnect failed'));

      await expect(service.disconnect()).rejects.toThrow('disconnect failed');
      expect(service.state).toBe(ConnectionState.ERROR);
    });

    it('should be a no-op when already DISCONNECTED', async () => {
      keyvRedis.disconnect.mockResolvedValue(undefined);
      await service.disconnect();

      keyvRedis.disconnect.mockClear();
      await service.disconnect();

      expect(keyvRedis.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should call connect', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(service.state).toBe(ConnectionState.CONNECTED);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect if not already DISCONNECTED', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);
      keyvRedis.disconnect.mockResolvedValue(undefined);

      await service.connect();
      await service.onModuleDestroy();

      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should be a no-op if already DISCONNECTED', async () => {
      keyvRedis.disconnect.mockClear();

      await service.onModuleDestroy();

      expect(keyvRedis.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('isHealthy', () => {
    it('should return true when CONNECTED and cache operations succeed', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);
      await service.connect();

      const result = await service.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when not CONNECTED', async () => {
      const result = await service.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when cache operations fail', async () => {
      cache.set.mockResolvedValue(undefined);
      cache.del.mockResolvedValue(undefined);
      await service.connect();

      cache.set.mockRejectedValueOnce(new Error('redis error'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return the raw Redis client', () => {
      const client = service.getClient();
      expect(client).toBe(keyvRedis.client);
    });

    it('should throw if keyvRedis has no client property', async () => {
      const { unit: svc } = await TestBed.solitary(CacheService)
        .mock(CACHE_MANAGER)
        .impl(() => ({
          get: jest.fn(),
          set: jest.fn(),
          del: jest.fn(),
        }))
        .mock(KeyvRedisKey)
        .impl(() => ({
          disconnect: jest.fn(),
        }))
        .compile();

      expect(() => svc.getClient()).toThrow('Redis client not available');
    });
  });

  describe('get', () => {
    it('should return cached value', async () => {
      cache.get.mockResolvedValue({ foo: 'bar' });

      const result = await service.get('test-key');

      expect(result).toEqual({ foo: 'bar' });
      expect(cache.get).toHaveBeenCalledWith('test-key');
    });

    it('should return undefined when cache returns null', async () => {
      cache.get.mockResolvedValue(null);

      const result = await service.get('test-key');

      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set value with ttl', async () => {
      cache.set.mockResolvedValue(undefined);

      await service.set('key', { data: 1 }, 5000);

      expect(cache.set).toHaveBeenCalledWith('key', { data: 1 }, 5000);
    });

    it('should set value without ttl', async () => {
      cache.set.mockResolvedValue(undefined);

      await service.set('key', 'value');

      expect(cache.set).toHaveBeenCalledWith('key', 'value', undefined);
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      cache.del.mockResolvedValue(undefined);

      await service.del('key');

      expect(cache.del).toHaveBeenCalledWith('key');
    });
  });

  describe('delByPattern', () => {
    it('should delete keys matching a pattern and return count', async () => {
      const scanIterator = (async function* (): AsyncGenerator<string | string[]> {
        yield ['prefix:1', 'prefix:2'];
        yield 'prefix:3';
      })();

      keyvRedis.client.scanIterator.mockReturnValue(scanIterator);
      cache.del.mockResolvedValue(undefined);

      const count = await service.delByPattern('prefix:*');

      expect(count).toBe(3);
      expect(cache.del).toHaveBeenCalledWith('prefix:1');
      expect(cache.del).toHaveBeenCalledWith('prefix:2');
      expect(cache.del).toHaveBeenCalledWith('prefix:3');
    });

    it('should return 0 when no keys match', async () => {
      const scanIterator = (async function* (): AsyncGenerator<string | string[]> {
        // empty
      })();

      keyvRedis.client.scanIterator.mockReturnValue(scanIterator);

      const count = await service.delByPattern('no-match:*');

      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all stores', async () => {
      const clearFn = jest.fn().mockResolvedValue(undefined);
      (cache as unknown as { stores: Array<{ clear: jest.Mock }> }).stores = [{ clear: clearFn }];

      await service.clear();

      expect(clearFn).toHaveBeenCalled();
    });

    it('should handle cache without stores', async () => {
      await expect(service.clear()).resolves.toBeUndefined();
    });
  });

  describe('sorted set operations', () => {
    it('zAdd should add member with score', async () => {
      keyvRedis.client.zAdd.mockResolvedValue(1);

      const result = await service.zAdd('leaderboard', 100, 'player1');

      expect(result).toBe(1);
      expect(keyvRedis.client.zAdd).toHaveBeenCalledWith('leaderboard', {
        score: 100,
        value: 'player1',
      });
    });

    it('zRevRank should return 1-indexed rank', async () => {
      keyvRedis.client.zRevRank.mockResolvedValue(0);

      const result = await service.zRevRank('leaderboard', 'player1');

      expect(result).toBe(1);
    });

    it('zRevRank should return null if member not found', async () => {
      keyvRedis.client.zRevRank.mockResolvedValue(null);

      const result = await service.zRevRank('leaderboard', 'unknown');

      expect(result).toBeNull();
    });

    it('zCard should return cardinality', async () => {
      keyvRedis.client.zCard.mockResolvedValue(5);

      const result = await service.zCard('leaderboard');

      expect(result).toBe(5);
    });
  });

  describe('wrap (single-flight)', () => {
    it('should return cached value on cache hit', async () => {
      cache.get.mockResolvedValue('cached-result');
      const fn = jest.fn();

      const result = await service.wrap('key', fn);

      expect(result).toBe('cached-result');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should call fn and cache result on cache miss', async () => {
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(undefined);
      const fn = jest.fn().mockResolvedValue('fresh-result');

      const result = await service.wrap('key', fn, 5000);

      expect(result).toBe('fresh-result');
      expect(fn).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('should coalesce concurrent requests for the same key', async () => {
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(undefined);

      let resolvePromise: (value: string) => void;
      const fn = jest.fn().mockReturnValue(
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const p1 = service.wrap('key', fn);
      const p2 = service.wrap('key', fn);

      resolvePromise!('result');

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe('result');
      expect(r2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should clean up inflight entry after completion', async () => {
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(undefined);
      const fn = jest.fn().mockResolvedValue('result');

      await service.wrap('key', fn);

      // Second call with same key should not join, because the first completed
      cache.get.mockResolvedValue(null);
      const fn2 = jest.fn().mockResolvedValue('result2');

      const result = await service.wrap('key', fn2);

      expect(result).toBe('result2');
      expect(fn2).toHaveBeenCalled();
    });

    it('should clean up inflight entry even on error', async () => {
      cache.get.mockResolvedValue(null);
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(service.wrap('key', fn)).rejects.toThrow('fail');

      // Subsequent call should start fresh
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(undefined);
      const fn2 = jest.fn().mockResolvedValue('ok');

      const result = await service.wrap('key', fn2);

      expect(result).toBe('ok');
    });
  });
});
