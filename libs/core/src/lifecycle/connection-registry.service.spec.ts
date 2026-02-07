jest.mock('uuid', () => ({ v7: jest.fn(() => 'mock-uuid') }));

import { TestBed, Mocked } from '@suites/unit';
import { createMockConnection } from '@test/factories/managed-connection.factory';

import { ConnectionRegistryService } from './connection-registry.service';
import { ConnectionState } from './lifecycle.interface';
import { LoggerService } from '../logger/logger.service';

describe('ConnectionRegistryService', () => {
  let service: ConnectionRegistryService;
  let logger: Mocked<LoggerService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(ConnectionRegistryService).compile();
    service = unit;
    logger = unitRef.get(LoggerService);
  });

  describe('register', () => {
    it('should register a connection with default metadata', () => {
      const conn = createMockConnection('database');
      service.register(conn);

      const entry = service.get('database');
      expect(entry).toBeDefined();
      expect(entry!.connection).toBe(conn);
      expect(entry!.metadata.name).toBe('database');
      expect(entry!.metadata.shutdownPriority).toBe(0);
      expect(entry!.metadata.required).toBe(true);
      expect(entry!.registeredAt).toBeInstanceOf(Date);
    });

    it('should register a connection with custom metadata', () => {
      const conn = createMockConnection('kafka');
      service.register(conn, {
        shutdownPriority: 20,
        required: false,
        shutdownTimeout: 5000,
      });

      const entry = service.get('kafka');
      expect(entry!.metadata.shutdownPriority).toBe(20);
      expect(entry!.metadata.required).toBe(false);
      expect(entry!.metadata.shutdownTimeout).toBe(5000);
    });

    it('should warn and replace when registering duplicate connection name', () => {
      const conn1 = createMockConnection('database');
      const conn2 = createMockConnection('database');

      service.register(conn1);
      service.register(conn2);

      expect(logger.warn).toHaveBeenCalled();
      expect(service.get('database')!.connection).toBe(conn2);
      expect(service.getConnectionCount()).toBe(1);
    });
  });

  describe('unregister', () => {
    it('should remove a registered connection and return true', () => {
      service.register(createMockConnection('redis'));
      const result = service.unregister('redis');

      expect(result).toBe(true);
      expect(service.get('redis')).toBeUndefined();
    });

    it('should return false when unregistering a non-existent connection', () => {
      const result = service.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return undefined for unknown connection', () => {
      expect(service.get('unknown')).toBeUndefined();
    });

    it('should return the entry for a known connection', () => {
      const conn = createMockConnection('database');
      service.register(conn);
      expect(service.get('database')!.connection).toBe(conn);
    });
  });

  describe('getAllConnections', () => {
    it('should return empty array when no connections registered', () => {
      expect(service.getAllConnections()).toEqual([]);
    });

    it('should return all registered connections', () => {
      service.register(createMockConnection('database'));
      service.register(createMockConnection('redis'));
      service.register(createMockConnection('kafka'));

      expect(service.getAllConnections()).toHaveLength(3);
    });
  });

  describe('getRequiredConnections', () => {
    it('should return only connections with required=true', () => {
      service.register(createMockConnection('database'), { required: true });
      service.register(createMockConnection('redis'), { required: false });
      service.register(createMockConnection('kafka'), { required: true });

      const required = service.getRequiredConnections();
      expect(required).toHaveLength(2);
      expect(required.map((e) => e.metadata.name)).toEqual(['database', 'kafka']);
    });
  });

  describe('areAllRequiredReady', () => {
    it('should return true when no connections are registered', async () => {
      await expect(service.areAllRequiredReady()).resolves.toBe(true);
    });

    it('should return true when all required connections are connected and healthy', async () => {
      service.register(createMockConnection('database'));
      service.register(createMockConnection('redis'));

      await expect(service.areAllRequiredReady()).resolves.toBe(true);
    });

    it('should return false when a required connection is not connected', async () => {
      service.register(createMockConnection('database', { state: ConnectionState.CONNECTING }));

      await expect(service.areAllRequiredReady()).resolves.toBe(false);
    });

    it('should return false when a required connection health check fails', async () => {
      service.register(
        createMockConnection('database', {
          isHealthy: jest.fn().mockResolvedValue(false),
        }),
      );

      await expect(service.areAllRequiredReady()).resolves.toBe(false);
    });

    it('should return false when isHealthy throws an error', async () => {
      service.register(
        createMockConnection('database', {
          isHealthy: jest.fn().mockRejectedValue(new Error('health check failed')),
        }),
      );

      await expect(service.areAllRequiredReady()).resolves.toBe(false);
    });

    it('should ignore non-required connections', async () => {
      service.register(createMockConnection('optional', { state: ConnectionState.DISCONNECTED }), {
        required: false,
      });

      await expect(service.areAllRequiredReady()).resolves.toBe(true);
    });
  });

  describe('getPendingRequiredConnections', () => {
    it('should return names of required connections that are not connected', () => {
      service.register(createMockConnection('database', { state: ConnectionState.CONNECTED }));
      service.register(createMockConnection('kafka', { state: ConnectionState.CONNECTING }));
      service.register(createMockConnection('redis', { state: ConnectionState.DISCONNECTED }));

      const pending = service.getPendingRequiredConnections();
      expect(pending).toEqual(['kafka', 'redis']);
    });

    it('should return empty array when all required connections are connected', () => {
      service.register(createMockConnection('database'));
      expect(service.getPendingRequiredConnections()).toEqual([]);
    });
  });

  describe('onStateChange / emitStateChange', () => {
    it('should notify listeners when state changes are emitted', () => {
      const listener = jest.fn();
      service.onStateChange(listener);

      service.emitStateChange('database', ConnectionState.CONNECTED);

      expect(listener).toHaveBeenCalledWith('database', ConnectionState.CONNECTED);
    });

    it('should notify multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      service.onStateChange(listener1);
      service.onStateChange(listener2);

      service.emitStateChange('redis', ConnectionState.ERROR);

      expect(listener1).toHaveBeenCalledWith('redis', ConnectionState.ERROR);
      expect(listener2).toHaveBeenCalledWith('redis', ConnectionState.ERROR);
    });

    it('should stop notifying after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = service.onStateChange(listener);

      unsubscribe();
      service.emitStateChange('database', ConnectionState.DISCONNECTED);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('hasConnections / getConnectionCount', () => {
    it('should return false and 0 when empty', () => {
      expect(service.hasConnections()).toBe(false);
      expect(service.getConnectionCount()).toBe(0);
    });

    it('should reflect registered connections', () => {
      service.register(createMockConnection('database'));
      service.register(createMockConnection('redis'));

      expect(service.hasConnections()).toBe(true);
      expect(service.getConnectionCount()).toBe(2);
    });

    it('should update after unregister', () => {
      service.register(createMockConnection('database'));
      service.unregister('database');

      expect(service.hasConnections()).toBe(false);
      expect(service.getConnectionCount()).toBe(0);
    });
  });
});
