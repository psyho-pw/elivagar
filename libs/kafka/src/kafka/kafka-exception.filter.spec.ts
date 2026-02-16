import { ArgumentsHost } from '@nestjs/common';
import { EMPTY } from 'rxjs';
import { KafkaExceptionFilter } from './kafka-exception.filter';

describe('KafkaExceptionFilter', () => {
  let filter: KafkaExceptionFilter;
  let loggerService: { error: jest.Mock };

  beforeEach(() => {
    loggerService = { error: jest.fn() };
    filter = new KafkaExceptionFilter(loggerService as any);
  });

  describe('when host type is rpc', () => {
    it('should log the error and return EMPTY', () => {
      const topic = 'test.topic';
      const partition = 0;
      const error = new Error('test error');

      const host = {
        getType: () => 'rpc',
        switchToRpc: () => ({
          getContext: () => ({
            getTopic: () => topic,
            getPartition: () => partition,
          }),
        }),
      } as unknown as ArgumentsHost;

      const result = filter.catch(error, host);

      expect(result).toBe(EMPTY);
      expect(loggerService.error).toHaveBeenCalledWith(
        'catch',
        { topic, partition, error },
        `Kafka consumer error on topic: ${topic}`,
      );
    });
  });

  describe('when host type is not rpc', () => {
    it('should re-throw the exception', () => {
      const error = new Error('test error');

      const host = {
        getType: () => 'http',
      } as unknown as ArgumentsHost;

      expect(() => filter.catch(error, host)).toThrow(error);
      expect(loggerService.error).not.toHaveBeenCalled();
    });
  });
});
