jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid-v7'),
}));

import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { TestBed, Mocked } from '@suites/unit';
import { createMockExecutionContext } from '@test/factories/execution-context.factory';
import { of, throwError, lastValueFrom } from 'rxjs';
import { ErrorInterceptor } from './error.interceptor';
import { LoggerService } from '../../logger/logger.service';

describe('ErrorInterceptor', () => {
  let interceptor: ErrorInterceptor;
  let loggerService: Mocked<LoggerService>;
  let mockNext: jest.Mocked<CallHandler>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(ErrorInterceptor).compile();

    interceptor = unit;
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = {
      handle: jest.fn(),
    };
  });

  function createMockContext(
    type: string = 'http',
    className: string = 'TestController',
    methodName: string = 'testMethod',
  ): ExecutionContext {
    const statusFn = jest.fn().mockReturnThis();
    return createMockExecutionContext({
      type,
      className,
      methodName,
      response: { status: statusFn },
    });
  }

  describe('HTTP context - HttpException handling', () => {
    it('should format BadRequestException as JSON response', async () => {
      const error = new BadRequestException('Validation failed');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      const result = await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(result).toEqual(
        expect.objectContaining({ message: 'Validation failed', statusCode: 400 }),
      );
    });

    it('should set correct status code on response for HttpException', async () => {
      const error = new NotFoundException('Not found');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      await lastValueFrom(interceptor.intercept(context, mockNext));

      const res = context.switchToHttp().getResponse();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should log 500 HttpException errors', async () => {
      const error = new InternalServerErrorException('Server error');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(loggerService.error).toHaveBeenCalledWith(
        'intercept',
        error,
        'TestController.testMethod',
      );
    });

    it('should NOT log non-500 HttpException errors', async () => {
      const error = new BadRequestException('Bad request');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(loggerService.error).not.toHaveBeenCalled();
    });

    it('should handle string response payload from HttpException', async () => {
      const error = new HttpException('Simple message', HttpStatus.BAD_REQUEST);
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      const result = await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(result).toEqual({ message: 'Simple message' });
    });

    it('should handle object response payload from HttpException', async () => {
      const payload = { message: 'Validation failed', errors: ['field is required'] };
      const error = new HttpException(payload, HttpStatus.UNPROCESSABLE_ENTITY);
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      const result = await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(result).toEqual(payload);
    });
  });

  describe('HTTP context - non-HttpException handling', () => {
    it('should return generic error message for non-HttpException', async () => {
      const error = new Error('Unexpected crash');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      const result = await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(result).toEqual({ message: 'Internal server error' });
    });

    it('should log unhandled errors with context tag', async () => {
      const error = new Error('Unexpected crash');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http', 'UserController', 'create');

      await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(loggerService.error).toHaveBeenCalledWith(
        'intercept',
        error,
        'Unhandled error in UserController.create',
      );
    });

    it('should set 500 status for non-HttpException without getStatus', async () => {
      const error = new Error('Random error');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      await lastValueFrom(interceptor.intercept(context, mockNext));

      const res = context.switchToHttp().getResponse();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should use getStatus from error if available for non-HttpException', async () => {
      const error = { getStatus: (): number => 503, message: 'custom' };
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('http');

      await lastValueFrom(interceptor.intercept(context, mockNext));

      const res = context.switchToHttp().getResponse();
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('non-HTTP context (rpc)', () => {
    it('should re-throw HttpException in non-http context', async () => {
      const error = new BadRequestException('Bad request');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('rpc');

      await expect(lastValueFrom(interceptor.intercept(context, mockNext))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should re-throw non-HttpException in non-http context', async () => {
      const error = new Error('Unexpected');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('rpc');

      await expect(lastValueFrom(interceptor.intercept(context, mockNext))).rejects.toThrow(
        'Unexpected',
      );
    });

    it('should still log 500 HttpException in non-http context', async () => {
      const error = new InternalServerErrorException('Server broke');
      mockNext.handle.mockReturnValue(throwError(() => error));
      const context = createMockContext('rpc');

      await expect(lastValueFrom(interceptor.intercept(context, mockNext))).rejects.toThrow();

      expect(loggerService.error).toHaveBeenCalledWith(
        'intercept',
        error,
        'TestController.testMethod',
      );
    });
  });

  describe('passthrough', () => {
    it('should pass through successful responses', async () => {
      const responseData = { id: 1, name: 'test' };
      mockNext.handle.mockReturnValue(of(responseData));
      const context = createMockContext('http');

      const result = await lastValueFrom(interceptor.intercept(context, mockNext));

      expect(result).toEqual(responseData);
      expect(loggerService.error).not.toHaveBeenCalled();
    });
  });
});
