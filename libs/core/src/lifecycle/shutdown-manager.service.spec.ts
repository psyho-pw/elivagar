jest.mock('uuid', () => ({ v7: jest.fn(() => 'mock-uuid') }));

import { TestBed, Mocked } from '@suites/unit';
import { createMockConnection } from '@test/factories/managed-connection.factory';

import { ConnectionRegistryService } from './connection-registry.service';
import { SHUTDOWN_CONFIG } from './lifecycle.constant';
import {
  ConnectionState,
  IConnectionEntry,
  IManagedConnection,
  IShutdownConfig,
} from './lifecycle.interface';
import { ShutdownManagerService } from './shutdown-manager.service';
import { LoggerService } from '../logger/logger.service';

function createEntry(
  name: string,
  priority: number,
  connection?: jest.Mocked<IManagedConnection>,
): IConnectionEntry {
  return {
    connection: connection ?? createMockConnection(name),
    metadata: {
      name,
      shutdownPriority: priority,
      required: true,
    },
    registeredAt: new Date(),
  };
}

describe('ShutdownManagerService', () => {
  let service: ShutdownManagerService;
  let registry: Mocked<ConnectionRegistryService>;
  let logger: Mocked<LoggerService>;

  beforeEach(async () => {
    jest.useFakeTimers();

    const { unit, unitRef } = await TestBed.solitary(ShutdownManagerService)
      .mock(SHUTDOWN_CONFIG)
      .impl(() => ({ timeout: 10000, gracePeriod: 0 }) as IShutdownConfig)
      .compile();

    service = unit;
    registry = unitRef.get(ConnectionRegistryService);
    logger = unitRef.get(LoggerService);

    registry.getAllConnections.mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('beforeApplicationShutdown', () => {
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

    it('should wait for grace period before proceeding', async () => {
      const svc = new ShutdownManagerService(
        registry as unknown as ConnectionRegistryService,
        { timeout: 10000, gracePeriod: 3000 },
        logger as unknown as LoggerService,
      );

      let resolved = false;
      const promise = svc.beforeApplicationShutdown('SIGTERM').then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(resolved).toBe(true);
    });

    it('should skip grace period when set to 0', async () => {
      await service.beforeApplicationShutdown('SIGTERM');

      // Should complete without needing timers
    });

    it('should not run shutdown logic twice', async () => {
      const svc = new ShutdownManagerService(
        registry as unknown as ConnectionRegistryService,
        { timeout: 10000, gracePeriod: 100 },
        logger as unknown as LoggerService,
      );

      const promise1 = svc.beforeApplicationShutdown('SIGTERM');
      await jest.advanceTimersByTimeAsync(100);
      await promise1;

      // Second call should return early
      await svc.beforeApplicationShutdown('SIGINT');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('already in progress'),
      );
    });

    it('should use default grace period when config value is undefined', async () => {
      const minConfig: IShutdownConfig = {};
      const svc = new ShutdownManagerService(
        registry as unknown as ConnectionRegistryService,
        minConfig,
        logger as unknown as LoggerService,
      );

      let resolved = false;
      const promise = svc.beforeApplicationShutdown('SIGTERM').then(() => {
        resolved = true;
      });

      // Default grace period is 5000ms
      await jest.advanceTimersByTimeAsync(4999);
      expect(resolved).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('onApplicationShutdown', () => {
    it('should complete without error when no connections are registered', async () => {
      registry.getAllConnections.mockReturnValue([]);

      await expect(service.onApplicationShutdown('SIGTERM')).resolves.toBeUndefined();
    });

    it('should drain and then disconnect connections', async () => {
      const conn = createMockConnection('kafka', {
        drain: jest.fn().mockResolvedValue(undefined),
      });
      const entry = createEntry('kafka', 20, conn);
      registry.getAllConnections.mockReturnValue([entry]);

      await service.onApplicationShutdown('SIGTERM');

      expect(conn.drain).toHaveBeenCalled();
      expect(conn.disconnect).toHaveBeenCalled();
      // Drain should be called before disconnect
      const drainFn = conn.drain as jest.Mock;
      const disconnectFn = conn.disconnect as jest.Mock;
      expect(drainFn.mock.invocationCallOrder[0]).toBeLessThan(
        disconnectFn.mock.invocationCallOrder[0],
      );
    });

    it('should sort connections by shutdown priority (higher first)', async () => {
      const disconnectOrder: string[] = [];

      const dbConn = createMockConnection('database', {
        disconnect: jest.fn().mockImplementation(async () => {
          disconnectOrder.push('database');
        }),
      });
      const kafkaConn = createMockConnection('kafka', {
        disconnect: jest.fn().mockImplementation(async () => {
          disconnectOrder.push('kafka');
        }),
      });
      const redisConn = createMockConnection('redis', {
        disconnect: jest.fn().mockImplementation(async () => {
          disconnectOrder.push('redis');
        }),
      });

      const entries = [
        createEntry('database', 0, dbConn),
        createEntry('kafka', 20, kafkaConn),
        createEntry('redis', 10, redisConn),
      ];

      registry.getAllConnections.mockReturnValue(entries);

      await service.onApplicationShutdown('SIGTERM');

      expect(disconnectOrder).toEqual(['kafka', 'redis', 'database']);
    });

    it('should skip drain for connections without drain method', async () => {
      const conn = createMockConnection('database');
      // No drain method (default mock doesn't add one)
      const entry = createEntry('database', 0, conn);
      registry.getAllConnections.mockReturnValue([entry]);

      await service.onApplicationShutdown('SIGTERM');

      expect(conn.disconnect).toHaveBeenCalled();
    });

    it('should skip disconnect for already disconnected connections', async () => {
      const conn = createMockConnection('database', {
        state: ConnectionState.DISCONNECTED,
      });
      const entry = createEntry('database', 0, conn);
      registry.getAllConnections.mockReturnValue([entry]);

      await service.onApplicationShutdown('SIGTERM');

      expect(conn.disconnect).not.toHaveBeenCalled();
    });

    it('should continue shutting down other connections if one fails during drain', async () => {
      const failConn = createMockConnection('kafka', {
        drain: jest.fn().mockRejectedValue(new Error('drain failed')),
      });
      const okConn = createMockConnection('database');

      const entries = [createEntry('kafka', 20, failConn), createEntry('database', 0, okConn)];
      registry.getAllConnections.mockReturnValue(entries);

      await service.onApplicationShutdown('SIGTERM');

      expect(logger.error).toHaveBeenCalled();
      expect(okConn.disconnect).toHaveBeenCalled();
    });

    it('should continue shutting down other connections if one fails during disconnect', async () => {
      const failConn = createMockConnection('kafka', {
        disconnect: jest.fn().mockRejectedValue(new Error('disconnect failed')),
      });
      const okConn = createMockConnection('database');

      const entries = [createEntry('kafka', 20, failConn), createEntry('database', 0, okConn)];
      registry.getAllConnections.mockReturnValue(entries);

      await service.onApplicationShutdown('SIGTERM');

      expect(logger.error).toHaveBeenCalled();
      expect(okConn.disconnect).toHaveBeenCalled();
    });

    it('should timeout a slow drain operation', async () => {
      const slowConn = createMockConnection('kafka', {
        drain: jest
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 60000))),
      });
      const entry: IConnectionEntry = {
        connection: slowConn,
        metadata: { name: 'kafka', shutdownPriority: 20, required: true, shutdownTimeout: 500 },
        registeredAt: new Date(),
      };

      registry.getAllConnections.mockReturnValue([entry]);

      const promise = service.onApplicationShutdown('SIGTERM');

      // Advance past the per-connection shutdownTimeout (500ms)
      await jest.advanceTimersByTimeAsync(1000);

      await promise;

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.stringContaining('kafka'),
      );
    });

    it('should timeout a slow disconnect operation', async () => {
      const slowConn = createMockConnection('database', {
        disconnect: jest
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 60000))),
      });
      const entry: IConnectionEntry = {
        connection: slowConn,
        metadata: { name: 'database', shutdownPriority: 0, required: true, shutdownTimeout: 300 },
        registeredAt: new Date(),
      };

      registry.getAllConnections.mockReturnValue([entry]);

      const promise = service.onApplicationShutdown('SIGTERM');

      await jest.advanceTimersByTimeAsync(1000);

      await promise;

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.stringContaining('database'),
      );
    });

    it('should use global config timeout when per-connection shutdownTimeout is not set', async () => {
      const customConfig: IShutdownConfig = { timeout: 200 };
      const svc = new ShutdownManagerService(
        registry as unknown as ConnectionRegistryService,
        customConfig,
        logger as unknown as LoggerService,
      );

      const slowConn = createMockConnection('redis', {
        disconnect: jest
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 60000))),
      });
      const entry = createEntry('redis', 10, slowConn);

      registry.getAllConnections.mockReturnValue([entry]);

      const promise = svc.onApplicationShutdown('SIGTERM');

      await jest.advanceTimersByTimeAsync(500);

      await promise;

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
