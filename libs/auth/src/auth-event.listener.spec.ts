import { CacheServiceKey } from '@app/cache/cache.constant';
import { ICacheService } from '@app/cache/cache.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { faker } from '@faker-js/faker';
import { TestBed, Mocked } from '@suites/unit';
import { AuthSessionRevokedEvent } from '@app/kafka/events/events.interface';
import { AuthEventListener } from './auth-event.listener';
import { AUTH_TOKEN_CACHE_PREFIX } from './auth.constant';

describe('AuthEventListener', () => {
  let listener: AuthEventListener;
  let cacheService: Mocked<ICacheService>;
  let loggerService: Mocked<LoggerService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(AuthEventListener).compile();

    listener = unit;
    cacheService = unitRef.get(CacheServiceKey);
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('handleSessionRevoked', () => {
    it('should delete the cached token by hash', async () => {
      const tokenHash = faker.string.hexadecimal({ length: 64, prefix: '' });
      const userId = faker.string.uuid();

      const payload: AuthSessionRevokedEvent = {
        tokenHash,
        userId,
      };

      await listener.handleSessionRevoked(payload);

      const expectedKey = `${AUTH_TOKEN_CACHE_PREFIX}:${tokenHash}`;
      expect(cacheService.del).toHaveBeenCalledWith(expectedKey);
    });

    it('should log the session revoked event with userId', async () => {
      const tokenHash = faker.string.hexadecimal({ length: 64, prefix: '' });
      const userId = faker.string.uuid();
      const reason = faker.lorem.words(2);

      const payload: AuthSessionRevokedEvent = {
        tokenHash,
        userId,
        reason,
      };

      await listener.handleSessionRevoked(payload);

      expect(loggerService.info).toHaveBeenCalledWith(
        'handleSessionRevoked',
        { userId },
        `Session revoked, hash: ${tokenHash}`,
      );
    });

    it('should propagate error when cache del fails', async () => {
      const tokenHash = faker.string.hexadecimal({ length: 64, prefix: '' });
      const userId = faker.string.uuid();
      const cacheError = new Error('Redis connection lost');

      cacheService.del.mockRejectedValue(cacheError);

      const payload: AuthSessionRevokedEvent = { tokenHash, userId };

      await expect(listener.handleSessionRevoked(payload)).rejects.toThrow('Redis connection lost');
    });
  });
});
