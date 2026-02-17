import { LoggerService } from '@app/core/logger/logger.service';
import { ArgumentsHost } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { EMPTY } from 'rxjs';

import { KafkaExceptionFilter } from './kafka-exception.filter';

describe('KafkaExceptionFilter', () => {
  let filter: KafkaExceptionFilter;
  let _loggerService: { error: jest.Mock };

  const topic = 'test.topic';
  const partition = 0;

  const createRpcHost = (): ArgumentsHost => {
    const kafkaContext = new KafkaContext([
      {} as never, // message
      partition,
      topic,
      {} as never, // consumer
      (() => Promise.resolve()) as never, // heartbeat
      {} as never, // producer
    ]);

    return {
      getType: () => 'rpc',
      switchToRpc: () => ({
        getContext: () => kafkaContext,
      }),
    } as unknown as ArgumentsHost;
  };

  const createNonRpcHost = (type: string = 'http'): ArgumentsHost =>
    ({
      getType: () => type,
    }) as unknown as ArgumentsHost;

  beforeAll(() => {
    _loggerService = { error: jest.fn() };
    filter = new KafkaExceptionFilter(_loggerService as unknown as LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('catch', () => {
    describe('when host type is rpc', () => {
      it('should log the error with correct params and return EMPTY', () => {
        const error = new Error('kafka processing failed');
        const host = createRpcHost();

        const result = filter.catch(error, host);

        expect(result).toBe(EMPTY);
        expect(_loggerService.error).toHaveBeenCalledTimes(1);
        expect(_loggerService.error).toHaveBeenCalledWith(
          'catch',
          { topic, partition, error },
          `Kafka consumer error on topic: ${topic}`,
        );
      });

      it('should handle an Error exception', () => {
        const error = new Error('something broke');
        const host = createRpcHost();

        const result = filter.catch(error, host);

        expect(result).toBe(EMPTY);
        expect(_loggerService.error).toHaveBeenCalledWith(
          'catch',
          { topic, partition, error },
          `Kafka consumer error on topic: ${topic}`,
        );
      });

      it('should handle a string exception', () => {
        const error = 'string error message';
        const host = createRpcHost();

        const result = filter.catch(error, host);

        expect(result).toBe(EMPTY);
        expect(_loggerService.error).toHaveBeenCalledWith(
          'catch',
          { topic, partition, error: 'string error message' },
          `Kafka consumer error on topic: ${topic}`,
        );
      });

      it('should handle a plain object exception', () => {
        const error = { code: 'ERR_TIMEOUT', detail: 'connection timed out' };
        const host = createRpcHost();

        const result = filter.catch(error, host);

        expect(result).toBe(EMPTY);
        expect(_loggerService.error).toHaveBeenCalledWith(
          'catch',
          { topic, partition, error },
          `Kafka consumer error on topic: ${topic}`,
        );
      });

      it('should handle null and undefined exceptions', () => {
        const host = createRpcHost();

        expect(filter.catch(null, host)).toBe(EMPTY);
        expect(filter.catch(undefined, host)).toBe(EMPTY);
        expect(_loggerService.error).toHaveBeenCalledTimes(2);
      });
    });

    describe('when host type is not rpc', () => {
      it('should re-throw the exception without logging', () => {
        const error = new Error('not an rpc context');
        const host = createNonRpcHost('http');

        expect(() => filter.catch(error, host)).toThrow(error);
        expect(_loggerService.error).not.toHaveBeenCalled();
      });

      it('should re-throw a string exception', () => {
        const error = 'string error';
        const host = createNonRpcHost('http');

        expect(() => filter.catch(error, host)).toThrow('string error');
        expect(_loggerService.error).not.toHaveBeenCalled();
      });

      it('should re-throw for ws host type', () => {
        const error = new Error('ws error');
        const host = createNonRpcHost('ws');

        expect(() => filter.catch(error, host)).toThrow(error);
        expect(_loggerService.error).not.toHaveBeenCalled();
      });
    });
  });
});
