jest.mock('uuid', () => ({
  v7: (): string => 'mock-uuid-v7',
}));

import { LoggerService } from '@app/core/logger/logger.service';
import { AnonymousFunction } from '@app/core/types/anonymous-function.type';
import { Mocked, TestBed } from '@suites/unit';
import { WrapParams } from '@toss/nestjs-aop';
import { CacheAspect } from './cache.aspect';
import { CacheKeyType, CacheServiceKey } from './cache.constant';
import { CacheOptions, CacheableQuery } from './cache.interface';
import { CacheService } from './cache.service';

describe('CacheAspect', () => {
  let aspect: CacheAspect;
  let cacheService: Mocked<CacheService>;
  let logger: Mocked<LoggerService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(CacheAspect).compile();

    aspect = unit;
    cacheService = unitRef.get(CacheServiceKey);
    logger = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  function createWrapParams(
    options: CacheOptions,
    method?: (...args: unknown[]) => unknown,
  ): WrapParams<AnonymousFunction, CacheOptions> {
    return {
      method: method ?? jest.fn().mockResolvedValue('method-result'),
      metadata: options,
      methodName: 'testMethod',
      instance: {},
    } as WrapParams<AnonymousFunction, CacheOptions>;
  }

  describe('wrap - condition evaluation', () => {
    it('should bypass cache when condition returns false', async () => {
      const method = jest.fn().mockResolvedValue('direct-result');
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'test-key',
        condition: () => false,
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      const result = await wrapped('arg1');

      expect(result).toBe('direct-result');
      expect(cacheService.get).not.toHaveBeenCalled();
    });

    it('should use cache when condition returns true', async () => {
      cacheService.get.mockResolvedValue('cached');
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'test-key',
        condition: () => true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      const result = await wrapped();

      expect(result).toBe('cached');
    });

    it('should pass method arguments to condition function', async () => {
      const conditionSpy = jest.fn().mockReturnValue(false);
      const method = jest.fn().mockResolvedValue('result');
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'test-key',
        condition: conditionSpy,
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      await wrapped('arg1', 'arg2');

      expect(conditionSpy).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should proceed with caching when no condition is set', async () => {
      cacheService.get.mockResolvedValue('cached');
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'my-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      const result = await wrapped();

      expect(result).toBe('cached');
      expect(cacheService.get).toHaveBeenCalledWith('my-key');
    });
  });

  describe('wrap - invalidateExisting', () => {
    it('should delete the key before execution when invalidateExisting is true', async () => {
      cacheService.get.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.del.mockResolvedValue(undefined);

      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'my-key',
        invalidateExisting: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped();

      expect(cacheService.del).toHaveBeenCalledWith('my-key');
    });

    it('should not delete when invalidateExisting is false', async () => {
      cacheService.get.mockResolvedValue('cached');

      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'my-key',
        invalidateExisting: false,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped();

      expect(cacheService.del).not.toHaveBeenCalled();
    });
  });

  describe('wrap - withSingleFlight', () => {
    it('should delegate to cacheService.wrap when useSingleFlight is true', async () => {
      cacheService.wrap.mockResolvedValue('wrapped-result');

      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'sf-key',
        useSingleFlight: true,
        ttl: 3000,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      const result = await wrapped();

      expect(result).toBe('wrapped-result');
      expect(cacheService.wrap).toHaveBeenCalledWith('sf-key', expect.any(Function), 3000);
    });

    it('should fall back to direct method call when cacheService.wrap fails', async () => {
      const method = jest.fn().mockResolvedValue('fallback-result');
      cacheService.wrap.mockRejectedValue(new Error('wrap failed'));

      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'sf-key',
        useSingleFlight: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      const result = await wrapped('arg');

      expect(result).toBe('fallback-result');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('wrap - withoutSingleFlight (default)', () => {
    it('should return cached value on cache hit', async () => {
      cacheService.get.mockResolvedValue('cached-value');

      const method = jest.fn();
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'hit-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      const result = await wrapped();

      expect(result).toBe('cached-value');
      expect(method).not.toHaveBeenCalled();
    });

    it('should call method and cache result on cache miss', async () => {
      cacheService.get.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      const method = jest.fn().mockResolvedValue('new-result');
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'miss-key',
        ttl: 5000,
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      const result = await wrapped();

      expect(result).toBe('new-result');
      expect(cacheService.set).toHaveBeenCalledWith('miss-key', 'new-result', 5000);
    });

    it('should still return method result when cache set fails', async () => {
      cacheService.get.mockResolvedValue(undefined);
      cacheService.set.mockRejectedValue(new Error('set failed'));

      const method = jest.fn().mockResolvedValue('result-ok');
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'fail-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      const result = await wrapped();

      expect(result).toBe('result-ok');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should serialize class instances via instanceToPlain before caching', async () => {
      cacheService.get.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      class MyEntity {
        name = 'test';
        value = 42;
      }

      const entity = new MyEntity();
      const method = jest.fn().mockResolvedValue(entity);
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'entity-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      await wrapped();

      expect(cacheService.set).toHaveBeenCalledWith(
        'entity-key',
        { name: 'test', value: 42 },
        undefined,
      );
    });

    it('should not serialize plain objects', async () => {
      cacheService.get.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      const plain = { foo: 'bar' };
      const method = jest.fn().mockResolvedValue(plain);
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'plain-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      await wrapped();

      expect(cacheService.set).toHaveBeenCalledWith('plain-key', { foo: 'bar' }, undefined);
    });

    it('should serialize arrays of class instances', async () => {
      cacheService.get.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      class Item {
        id = 1;
      }

      const method = jest.fn().mockResolvedValue([new Item()]);
      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'arr-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options, method));
      await wrapped();

      expect(cacheService.set).toHaveBeenCalledWith('arr-key', [{ id: 1 }], undefined);
    });
  });

  describe('buildCacheKey - Plain type', () => {
    it('should return the key as-is for Plain type', async () => {
      cacheService.get.mockResolvedValue('hit');

      const options: CacheOptions = {
        type: CacheKeyType.Plain,
        key: 'exact:cache:key',
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped();

      expect(cacheService.get).toHaveBeenCalledWith('exact:cache:key');
    });
  });

  describe('buildCacheKey - Suffix type', () => {
    it('should append string ID at index 0 when useIdSuffix is true', async () => {
      cacheService.get.mockResolvedValue('hit');

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'users',
        useIdSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped('user-123');

      expect(cacheService.get).toHaveBeenCalledWith('users:user-123');
    });

    it('should append numeric ID at specified index', async () => {
      cacheService.get.mockResolvedValue('hit');

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'items',
        useIdSuffix: { index: 1 },
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped('ignored', 42);

      expect(cacheService.get).toHaveBeenCalledWith('items:42');
    });

    it('should extract id property from object argument', async () => {
      cacheService.get.mockResolvedValue('hit');

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'entities',
        useIdSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped({ id: 'abc-def' });

      expect(cacheService.get).toHaveBeenCalledWith('entities:abc-def');
    });

    it('should build query suffix from CacheableQuery argument', async () => {
      cacheService.get.mockResolvedValue('hit');

      const query: CacheableQuery = {
        toCachePayload: () => ({ page: 1, sort: 'name' }),
      };

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'list',
        useCacheableSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped(query);

      expect(cacheService.get).toHaveBeenCalledWith('list?page=1&sort=name');
    });

    it('should combine ID suffix and CacheableQuery suffix', async () => {
      cacheService.get.mockResolvedValue('hit');

      const query: CacheableQuery = {
        toCachePayload: () => ({ limit: 10 }),
      };

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'users',
        useIdSuffix: true,
        useCacheableSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped('uid-1', query);

      expect(cacheService.get).toHaveBeenCalledWith('users:uid-1?limit=10');
    });

    it('should generate key without suffix when no useIdSuffix or useCacheableSuffix', async () => {
      cacheService.get.mockResolvedValue('hit');

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'bare-key',
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped();

      expect(cacheService.get).toHaveBeenCalledWith('bare-key');
    });
  });

  describe('query normalization (toSuffix)', () => {
    it('should sort object keys alphabetically', async () => {
      cacheService.get.mockResolvedValue('hit');

      const query: CacheableQuery = {
        toCachePayload: () => ({ z: 1, a: 2, m: 3 }),
      };

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'sorted',
        useCacheableSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped(query);

      expect(cacheService.get).toHaveBeenCalledWith('sorted?a=2&m=3&z=1');
    });

    it('should sort array values', async () => {
      cacheService.get.mockResolvedValue('hit');

      const query: CacheableQuery = {
        toCachePayload: () => ({ tags: ['c', 'a', 'b'] }),
      };

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'arr',
        useCacheableSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped(query);

      expect(cacheService.get).toHaveBeenCalledWith('arr?tags=["a","b","c"]');
    });

    it('should filter out undefined values', async () => {
      cacheService.get.mockResolvedValue('hit');

      const query: CacheableQuery = {
        toCachePayload: () => ({ a: 1, b: undefined, c: 3 }),
      };

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'filtered',
        useCacheableSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped(query);

      expect(cacheService.get).toHaveBeenCalledWith('filtered?a=1&c=3');
    });

    it('should normalize nested objects', async () => {
      cacheService.get.mockResolvedValue('hit');

      const query: CacheableQuery = {
        toCachePayload: () => ({ filter: { z: 1, a: 2 } }),
      };

      const options: CacheOptions = {
        type: CacheKeyType.Suffix,
        key: 'nested',
        useCacheableSuffix: true,
      };

      const wrapped = aspect.wrap(createWrapParams(options));
      await wrapped(query);

      expect(cacheService.get).toHaveBeenCalledWith('nested?filter={"a":2,"z":1}');
    });
  });
});
