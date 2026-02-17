import { TestBed, Mocked } from '@suites/unit';

import { ConnectionRegistryService } from './connection-registry.service';
import { READINESS_CONFIG } from './lifecycle.constant';
import { IReadinessConfig } from './lifecycle.interface';
import { ReadinessGateService } from './readiness-gate.service';
import { LoggerService } from '../logger/logger.service';

describe('ReadinessGateService', () => {
  let service: ReadinessGateService;
  let registry: Mocked<ConnectionRegistryService>;
  let logger: Mocked<LoggerService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(ReadinessGateService)
      .mock(READINESS_CONFIG)
      .impl(() => ({ timeout: 5000, checkInterval: 100 }) as IReadinessConfig)
      .compile();

    service = unit;
    registry = unitRef.get(ConnectionRegistryService);
    logger = unitRef.get(LoggerService);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service.setReady(false);
    registry.hasConnections.mockReturnValue(true);
    registry.areAllRequiredReady.mockResolvedValue(false);
    registry.getPendingRequiredConnections.mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('waitForReady', () => {
    it('should resolve immediately when no connections are registered', async () => {
      registry.hasConnections.mockReturnValue(false);

      await service.waitForReady();

      expect(service.getIsReady()).toBe(true);
    });

    it('should resolve immediately when all connections are already ready', async () => {
      registry.areAllRequiredReady.mockResolvedValue(true);

      await service.waitForReady();

      expect(service.getIsReady()).toBe(true);
    });

    it('should poll until connections become ready', async () => {
      let callCount = 0;
      registry.areAllRequiredReady.mockImplementation(async () => {
        callCount++;
        return callCount >= 3;
      });
      registry.getPendingRequiredConnections.mockReturnValue(['database']);

      const promise = service.waitForReady();

      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);

      await promise;

      expect(service.getIsReady()).toBe(true);
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should throw on timeout when connections never become ready', async () => {
      registry.areAllRequiredReady.mockResolvedValue(false);
      registry.getPendingRequiredConnections.mockReturnValue(['database', 'redis']);

      let error: Error | undefined;
      const promise = service.waitForReady().catch((e) => {
        error = e;
      });

      await jest.advanceTimersByTimeAsync(6000);
      await promise;

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Readiness timeout after 5000ms/);
      expect(service.getIsReady()).toBe(false);
    });

    it('should use timeoutOverride when provided', async () => {
      registry.areAllRequiredReady.mockResolvedValue(false);
      registry.getPendingRequiredConnections.mockReturnValue(['kafka']);

      let error: Error | undefined;
      const promise = service.waitForReady(2000).catch((e) => {
        error = e;
      });

      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Readiness timeout after 2000ms/);
    });

    it('should use default timeout and checkInterval when config values are undefined', async () => {
      const minimalConfig: IReadinessConfig = {};
      const svc = new ReadinessGateService(
        registry as unknown as ConnectionRegistryService,
        minimalConfig,
        logger as unknown as LoggerService,
      );

      registry.areAllRequiredReady.mockResolvedValue(false);
      registry.getPendingRequiredConnections.mockReturnValue(['db']);

      let error: Error | undefined;
      const promise = svc.waitForReady().catch((e) => {
        error = e;
      });

      await jest.advanceTimersByTimeAsync(31000);
      await promise;

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Readiness timeout after 30000ms/);
    });

    it('should log pending connections during polling', async () => {
      let callCount = 0;
      registry.areAllRequiredReady.mockImplementation(async () => {
        callCount++;
        return callCount >= 2;
      });
      registry.getPendingRequiredConnections.mockReturnValue(['database']);

      const promise = service.waitForReady();

      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);

      await promise;

      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('database'),
      );
    });

    it('should not log pending connections when list is empty', async () => {
      let callCount = 0;
      registry.areAllRequiredReady.mockImplementation(async () => {
        callCount++;
        return callCount >= 2;
      });
      registry.getPendingRequiredConnections.mockReturnValue([]);

      const promise = service.waitForReady();
      await jest.advanceTimersByTimeAsync(200);
      await promise;

      const pendingCalls = (logger.debug.mock.calls as unknown[][]).filter(
        (call) => typeof call[1] === 'string' && call[1].includes('Waiting for connections'),
      );
      expect(pendingCalls).toHaveLength(0);
    });

    it('should include pending connection names in timeout error message', async () => {
      registry.areAllRequiredReady.mockResolvedValue(false);
      registry.getPendingRequiredConnections.mockReturnValue(['kafka', 'redis']);

      let error: Error | undefined;
      const promise = service.waitForReady().catch((e) => {
        error = e;
      });

      await jest.advanceTimersByTimeAsync(6000);
      await promise;

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/kafka, redis/);
    });

    it('should log error on timeout', async () => {
      registry.areAllRequiredReady.mockResolvedValue(false);
      registry.getPendingRequiredConnections.mockReturnValue(['database']);

      const promise = service.waitForReady().catch(() => {});

      await jest.advanceTimersByTimeAsync(6000);
      await promise;

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Readiness timeout'),
      );
    });
  });

  describe('getIsReady / setReady', () => {
    it('should default to false', () => {
      expect(service.getIsReady()).toBe(false);
    });

    it('should allow manual override via setReady', () => {
      service.setReady(true);
      expect(service.getIsReady()).toBe(true);

      service.setReady(false);
      expect(service.getIsReady()).toBe(false);
    });
  });
});
