jest.mock('uuid', () => ({ v7: jest.fn(() => 'mock-uuid') }));

import { TestBed, Mocked } from '@suites/unit';
import { GRACE_PERIOD_CONFIG } from './lifecycle.constant';
import { IGracePeriodConfig } from './lifecycle.interface';
import { GracePeriodService } from './grace-period.service';
import { LoggerService } from '../logger/logger.service';

describe('GracePeriodService', () => {
  let service: GracePeriodService;
  let logger: Mocked<LoggerService>;

  beforeEach(async () => {
    jest.useFakeTimers();

    const { unit, unitRef } = await TestBed.solitary(GracePeriodService)
      .mock(GRACE_PERIOD_CONFIG)
      .impl(() => ({ gracePeriod: 0 }) as IGracePeriodConfig)
      .compile();

    service = unit;
    logger = unitRef.get(LoggerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should log the shutdown signal', async () => {
    await service.beforeApplicationShutdown('SIGTERM');

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('SIGTERM'),
    );
  });

  it('should log "unknown" when no signal is provided', async () => {
    await service.beforeApplicationShutdown();

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('unknown'),
    );
  });

  it('should skip grace period when set to 0', async () => {
    await service.beforeApplicationShutdown('SIGTERM');

    // Should complete without needing timers
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should wait for grace period before completing', async () => {
    const svc = new GracePeriodService(
      { gracePeriod: 3000 },
      logger as unknown as LoggerService,
    );

    let resolved = false;
    const promise = svc.beforeApplicationShutdown('SIGTERM').then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(2999);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('should use default 5000ms when gracePeriod config is undefined', async () => {
    const svc = new GracePeriodService(
      {} as IGracePeriodConfig,
      logger as unknown as LoggerService,
    );

    let resolved = false;
    const promise = svc.beforeApplicationShutdown('SIGTERM').then(() => {
      resolved = true;
    });

    await jest.advanceTimersByTimeAsync(4999);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
