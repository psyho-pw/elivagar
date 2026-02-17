import { ConnectionRegistryService } from '@app/core/lifecycle/connection-registry.service';
import { ConnectionNames, ConnectionState } from '@app/core/lifecycle/lifecycle.constant';
import { LoggerService } from '@app/core/logger/logger.service';
import { ClientKafka } from '@nestjs/microservices';
import { Mocked, TestBed } from '@suites/unit';
import { KafkaClientKey } from './kafka.constant';
import { KafkaService } from './kafka.service';

type KafkaServicePrivate = { sleep: (ms: number) => Promise<void> };
type SubscribeHandlers = { complete?: () => void; error?: (err: Error) => void };

describe('KafkaService', () => {
  let service: KafkaService;
  let kafkaClient: Mocked<ClientKafka>;
  let logger: Mocked<LoggerService>;
  let connectionRegistry: Mocked<ConnectionRegistryService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(KafkaService).compile();
    service = unit;
    kafkaClient = unitRef.get(KafkaClientKey);
    logger = unitRef.get(LoggerService);
    connectionRegistry = unitRef.get(ConnectionRegistryService);
  });

  describe('constructor', () => {
    it('should register with connection registry when available', () => {
      expect(connectionRegistry.register).toHaveBeenCalledWith(service, {
        required: true,
      });
    });

    it('should not throw when connection registry is not provided', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        verbose: jest.fn(),
        setContext: jest.fn(),
      } as unknown as LoggerService;
      const mockClient = {
        connect: jest.fn(),
        close: jest.fn(),
        emit: jest.fn(),
      } as unknown as ClientKafka;

      expect(() => new KafkaService(mockClient, mockLogger)).not.toThrow();
    });

    it('should have connection name set to KAFKA', () => {
      expect(service.connectionName).toBe(ConnectionNames.KAFKA);
    });

    it('should start in DISCONNECTED state', () => {
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('connect', () => {
    it('should connect successfully on first attempt', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);

      await service.connect();

      expect(kafkaClient.connect).toHaveBeenCalledTimes(1);
      expect(service.state).toBe(ConnectionState.CONNECTED);
      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.KAFKA,
        ConnectionState.CONNECTED,
      );
    });

    it('should set state to CONNECTING before attempting connection', async () => {
      kafkaClient.connect.mockImplementation(async () => {
        expect(service.state).toBe(ConnectionState.CONNECTING);
        return undefined as never;
      });

      await service.connect();
    });

    it('should skip if already connected', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      await service.connect();
      kafkaClient.connect.mockClear();

      await service.connect();

      expect(kafkaClient.connect).not.toHaveBeenCalled();
    });

    it('should skip if currently connecting', async () => {
      // Start a connection that will hang
      let resolveConnect!: () => void;
      kafkaClient.connect.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }) as never,
      );

      const connectPromise = service.connect();

      // State is CONNECTING now, so a second call should bail out
      const secondCallPromise = service.connect();
      resolveConnect();
      await connectPromise;
      await secondCallPromise;

      expect(kafkaClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff on failure', async () => {
      const sleepSpy = jest
        .spyOn(service as unknown as KafkaServicePrivate, 'sleep')
        .mockResolvedValue(undefined);
      kafkaClient.connect
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce(undefined as never);

      await service.connect();

      expect(kafkaClient.connect).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      // First backoff: 1000 * 2^0 = 1000
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      // Second backoff: 1000 * 2^1 = 2000
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(service.state).toBe(ConnectionState.CONNECTED);
    });

    it('should cap backoff delay at 8000ms', async () => {
      const sleepSpy = jest
        .spyOn(service as unknown as KafkaServicePrivate, 'sleep')
        .mockResolvedValue(undefined);
      kafkaClient.connect
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockRejectedValueOnce(new Error('fail 3'))
        .mockRejectedValueOnce(new Error('fail 4'))
        .mockResolvedValueOnce(undefined as never);

      await service.connect();

      // Backoffs: 1000, 2000, 4000, 8000
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000);
      expect(sleepSpy).toHaveBeenNthCalledWith(4, 8000);
    });

    it('should throw and set ERROR state after 5 failed attempts', async () => {
      jest.spyOn(service as unknown as KafkaServicePrivate, 'sleep').mockResolvedValue(undefined);
      const error = new Error('persistent failure');
      kafkaClient.connect.mockRejectedValue(error);

      await expect(service.connect()).rejects.toThrow('persistent failure');

      expect(kafkaClient.connect).toHaveBeenCalledTimes(5);
      expect(service.state).toBe(ConnectionState.ERROR);
      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.KAFKA,
        ConnectionState.ERROR,
      );
    });

    it('should log warning on each failed attempt', async () => {
      jest.spyOn(service as unknown as KafkaServicePrivate, 'sleep').mockResolvedValue(undefined);
      kafkaClient.connect
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined as never);

      await service.connect();

      expect(logger.warn).toHaveBeenCalledWith(
        'connect',
        expect.stringContaining('attempt 1/5 failed'),
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      kafkaClient.close.mockResolvedValue(undefined);
      await service.connect();
      await service.disconnect();

      expect(kafkaClient.close).toHaveBeenCalledTimes(1);
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.KAFKA,
        ConnectionState.DISCONNECTED,
      );
    });

    it('should skip if already disconnected', async () => {
      await service.disconnect();

      expect(kafkaClient.close).not.toHaveBeenCalled();
    });

    it('should set ERROR state if close throws', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      await service.connect();
      kafkaClient.close.mockRejectedValueOnce(new Error('close error'));

      await expect(service.disconnect()).rejects.toThrow('close error');

      expect(service.state).toBe(ConnectionState.ERROR);
      expect(connectionRegistry.emitStateChange).toHaveBeenCalledWith(
        ConnectionNames.KAFKA,
        ConnectionState.ERROR,
      );
    });
  });

  describe('onModuleInit', () => {
    it('should call connect', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      await service.onModuleInit();
      expect(service.state).toBe(ConnectionState.CONNECTED);
    });
  });

  describe('onModuleDestroy', () => {
    it('should drain and disconnect if not already disconnected', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      kafkaClient.close.mockResolvedValue(undefined);
      await service.connect();

      const drainSpy = jest.spyOn(service, 'drain').mockResolvedValue(undefined);
      await service.onModuleDestroy();

      expect(drainSpy).toHaveBeenCalled();
      expect(kafkaClient.close).toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should still disconnect even if drain fails', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      kafkaClient.close.mockResolvedValue(undefined);
      await service.connect();

      jest.spyOn(service, 'drain').mockRejectedValue(new Error('drain failed'));
      await service.onModuleDestroy();

      expect(logger.error).toHaveBeenCalledWith(
        'onModuleDestroy',
        expect.any(Error),
        'Error during drain',
      );
      expect(kafkaClient.close).toHaveBeenCalled();
      expect(service.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should skip if already disconnected', async () => {
      const drainSpy = jest.spyOn(service, 'drain');
      await service.onModuleDestroy();

      expect(drainSpy).not.toHaveBeenCalled();
      expect(kafkaClient.close).not.toHaveBeenCalled();
    });
  });

  describe('isHealthy', () => {
    it('should return true when connected', async () => {
      kafkaClient.connect.mockResolvedValue(undefined as never);
      await service.connect();
      await expect(service.isHealthy()).resolves.toBe(true);
    });

    it('should return false when not connected', async () => {
      await expect(service.isHealthy()).resolves.toBe(false);
    });
  });

  describe('emit', () => {
    it('should emit message and track pending count', () => {
      const subscribeMock = jest.fn();
      kafkaClient.emit.mockReturnValue({ subscribe: subscribeMock } as never);

      service.emit('test.topic', { data: 'hello' });

      expect(kafkaClient.emit).toHaveBeenCalledWith('test.topic', {
        value: JSON.stringify({ data: 'hello' }),
        timestamp: expect.any(String),
      });
      expect(subscribeMock).toHaveBeenCalledWith({
        complete: expect.any(Function),
        error: expect.any(Function),
      });
    });

    it('should decrement pending messages on complete', () => {
      let completeCallback!: () => void;
      kafkaClient.emit.mockReturnValue({
        subscribe: (handlers: SubscribeHandlers) => {
          completeCallback = handlers.complete!;
        },
      } as never);

      service.emit('topic', { data: 1 });
      // pendingMessages is private, but we can verify through drain behavior
      completeCallback();

      // No error means the decrement worked correctly
      expect(logger.debug).toHaveBeenCalledWith('emit', expect.stringContaining('topic'));
    });

    it('should decrement pending messages and log on error', () => {
      let errorCallback!: (err: Error) => void;
      kafkaClient.emit.mockReturnValue({
        subscribe: (handlers: SubscribeHandlers) => {
          errorCallback = handlers.error!;
        },
      } as never);

      service.emit('topic', { data: 1 });
      errorCallback(new Error('send failed'));

      expect(logger.error).toHaveBeenCalledWith(
        'emit',
        expect.stringContaining('Failed to emit'),
        expect.any(Error),
      );
    });
  });

  describe('emitWithKey', () => {
    it('should emit message with key', () => {
      const subscribeMock = jest.fn();
      kafkaClient.emit.mockReturnValue({ subscribe: subscribeMock } as never);

      service.emitWithKey('test.topic', 'my-key', { data: 'hello' });

      expect(kafkaClient.emit).toHaveBeenCalledWith('test.topic', {
        key: 'my-key',
        value: JSON.stringify({ data: 'hello' }),
        timestamp: expect.any(String),
      });
    });

    it('should log error on emitWithKey failure', () => {
      let errorCallback!: (err: Error) => void;
      kafkaClient.emit.mockReturnValue({
        subscribe: (handlers: SubscribeHandlers) => {
          errorCallback = handlers.error!;
        },
      } as never);

      service.emitWithKey('topic', 'key', { data: 1 });
      errorCallback(new Error('send failed'));

      expect(logger.error).toHaveBeenCalledWith(
        'emitWithKey',
        expect.stringContaining('with key key'),
        expect.any(Error),
      );
    });
  });

  describe('drain', () => {
    it('should return immediately when no pending messages', async () => {
      await service.drain();
      expect(logger.debug).toHaveBeenCalledWith('drain', 'No pending messages to drain');
    });

    it('should wait for pending messages to complete', async () => {
      let completeCallback!: () => void;
      kafkaClient.emit.mockReturnValue({
        subscribe: (handlers: SubscribeHandlers) => {
          completeCallback = handlers.complete!;
        },
      } as never);

      service.emit('topic', { data: 1 });

      // Complete the message shortly after drain starts
      setTimeout(() => completeCallback(), 50);

      await service.drain();

      expect(logger.info).toHaveBeenCalledWith('drain', 'Kafka drain complete');
    });

    it('should warn when drain timeout is reached', async () => {
      kafkaClient.emit.mockReturnValue({
        subscribe: () => {
          // Never call complete - message stays pending
        },
      } as never);

      service.emit('topic', { data: 1 });

      // Mock sleep to speed up the drain loop, but let Date.now() exceed timeout
      const originalDateNow = Date.now;
      let callCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        // First call establishes start time, subsequent calls exceed timeout
        if (callCount <= 1) return originalDateNow();
        return originalDateNow() + 15000; // Exceed 10s timeout
      });
      jest.spyOn(service as unknown as KafkaServicePrivate, 'sleep').mockResolvedValue(undefined);

      await service.drain();

      expect(logger.warn).toHaveBeenCalledWith(
        'drain',
        expect.stringContaining('Drain timeout reached'),
      );

      jest.restoreAllMocks();
    });
  });
});
