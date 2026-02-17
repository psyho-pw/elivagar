import { MikroORM } from '@mikro-orm/core';
import { TestBed, Mocked } from '@suites/unit';
import { ConnectionRegistryService } from './connection-registry.service';
import { ConnectionNames, ConnectionState } from './lifecycle.constant';
import { MikroConnectionService } from './mikro-connection.service';

describe('MikroConnectionService', () => {
  let service: MikroConnectionService;
  let orm: Mocked<MikroORM>;
  let registry: Mocked<ConnectionRegistryService>;
  let execute: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue(undefined);

    const { unit, unitRef } = await TestBed.solitary(MikroConnectionService)
      .mock(MikroORM)
      .impl(() => ({
        isConnected: jest.fn().mockResolvedValue(true),
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        em: {
          getConnection: jest.fn().mockReturnValue({ execute }),
        },
      }))
      .compile();

    service = unit;
    orm = unitRef.get(MikroORM);
    registry = unitRef.get(ConnectionRegistryService);
  });

  describe('constructor', () => {
    it('should register itself with the connection registry', () => {
      expect(registry.register).toHaveBeenCalledWith(service, {
        required: true,
      });
    });

    it('should have connection name set to DATABASE', () => {
      expect(service.connectionName).toBe(ConnectionNames.DATABASE);
    });

    it('should start in DISCONNECTED state', () => {
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('onModuleInit', () => {
    it('should call connect', async () => {
      const connectSpy = jest.spyOn(service, 'connect');
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('should verify existing connection and transition to CONNECTED', async () => {
      await service.connect();

      expect(orm.isConnected).toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.CONNECTED);
    });

    it('should emit state change on successful connect', async () => {
      await service.connect();

      expect(registry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.DATABASE,
        ConnectionState.CONNECTED,
      );
    });

    it('should call orm.connect() when not already connected', async () => {
      orm.isConnected.mockResolvedValue(false);

      await service.connect();

      expect(orm.connect).toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.CONNECTED);
    });

    it('should not call orm.connect() when already connected', async () => {
      orm.isConnected.mockResolvedValue(true);

      await service.connect();

      expect(orm.connect).not.toHaveBeenCalled();
    });

    it('should verify connection with SELECT 1', async () => {
      await service.connect();

      expect(execute).toHaveBeenCalledWith('SELECT 1');
    });

    it('should transition to ERROR state when connect fails', async () => {
      const error = new Error('connection failed');
      orm.isConnected.mockRejectedValue(error);

      await expect(service.connect()).rejects.toThrow('connection failed');

      expect(service.state).toBe(ConnectionState.ERROR);
      expect(registry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.DATABASE,
        ConnectionState.ERROR,
      );
    });

    it('should be a no-op when already CONNECTED', async () => {
      await service.connect();
      orm.isConnected.mockClear();

      await service.connect();

      expect(orm.isConnected).not.toHaveBeenCalled();
    });

    it('should be a no-op when in CONNECTING state', async () => {
      jest.useFakeTimers();

      // Simulate a slow connect to keep state at CONNECTING
      orm.isConnected.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)));

      // Start connect but don't await - this sets state to CONNECTING
      const promise = service.connect();

      // Second call should return immediately since state is CONNECTING
      await service.connect();

      // The second isConnected should not be called since we returned early
      expect(orm.isConnected).toHaveBeenCalledTimes(1);

      // Clean up
      await jest.advanceTimersByTimeAsync(5000);
      await promise;
      jest.useRealTimers();
    });
  });

  describe('disconnect', () => {
    it('should close ORM and transition to DISCONNECTED', async () => {
      await service.connect();
      await service.disconnect();

      expect(orm.close).toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should emit state change on successful disconnect', async () => {
      await service.connect();
      registry.emitStateChange.mockClear();

      await service.disconnect();

      expect(registry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.DATABASE,
        ConnectionState.DISCONNECTED,
      );
    });

    it('should be a no-op when already DISCONNECTED', async () => {
      await service.disconnect();

      expect(orm.close).not.toHaveBeenCalled();
    });

    it('should transition to ERROR state when disconnect fails', async () => {
      await service.connect();
      orm.close.mockRejectedValue(new Error('close failed'));

      await expect(service.disconnect()).rejects.toThrow('close failed');

      expect(service.state).toBe(ConnectionState.ERROR);
      expect(registry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.DATABASE,
        ConnectionState.ERROR,
      );
    });
  });

  describe('isHealthy', () => {
    it('should return true when connected and SELECT 1 succeeds', async () => {
      await service.connect();

      const result = await service.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when not in CONNECTED state', async () => {
      const result = await service.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when SELECT 1 throws', async () => {
      await service.connect();

      execute.mockRejectedValue(new Error('query failed'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect if not already disconnected', async () => {
      await service.connect();
      await service.onModuleDestroy();

      expect(orm.close).toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should be a no-op when already disconnected', async () => {
      await service.onModuleDestroy();

      expect(orm.close).not.toHaveBeenCalled();
    });
  });
});
