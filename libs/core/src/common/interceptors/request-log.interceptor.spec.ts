import { CallHandler, ExecutionContext } from '@nestjs/common';
import { TestBed, Mocked } from '@suites/unit';
import { createMockExecutionContext } from '@test/factories/execution-context.factory';
import { of, lastValueFrom } from 'rxjs';
import { RequestLogInterceptor } from './request-log.interceptor';
import { LoggerService } from '../../logger/logger.service';

describe('RequestLogInterceptor', () => {
  let interceptor: RequestLogInterceptor;
  let loggerService: Mocked<LoggerService>;
  let mockNext: jest.Mocked<CallHandler>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(RequestLogInterceptor).compile();

    interceptor = unit;
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    };
  });

  function createMockHttpContext(
    overrides: { originalUrl?: string; method?: string; url?: string; statusCode?: number } = {},
  ): ExecutionContext {
    return createMockExecutionContext({
      request: {
        originalUrl: overrides.originalUrl ?? '/api/users',
        method: overrides.method ?? 'GET',
        url: overrides.url ?? '/api/users',
      },
      response: {
        statusCode: overrides.statusCode ?? 200,
      },
    });
  }

  describe('intercept', () => {
    it('should skip logging for /health-check path', async () => {
      const context = createMockHttpContext({ originalUrl: '/health-check' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should skip logging for /metrics path', async () => {
      const context = createMockHttpContext({ originalUrl: '/metrics' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should skip for non-http context', async () => {
      const context = {
        getType: () => 'rpc',
      } as unknown as ExecutionContext;

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should log request info on intercept', async () => {
      const context = createMockHttpContext({ method: 'POST', url: '/api/users' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.info).toHaveBeenCalledWith(
        'intercept',
        { method: 'POST', url: '/api/users' },
        'REQUEST [POST] /api/users',
      );
    });

    it('should log response info after handler completes', async () => {
      const context = createMockHttpContext({ method: 'GET', url: '/api/users', statusCode: 200 });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.info).toHaveBeenCalledWith(
        'intercept',
        expect.objectContaining({
          request: { method: 'GET', url: '/api/users' },
          response: expect.objectContaining({
            status: 200,
            responseTime: expect.any(Number),
          }),
        }),
        expect.stringContaining('RESPONSE [GET] /api/users'),
      );
    });

    it('should log slow request error when response time >= 10s', async () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(0) // startTime
        .mockReturnValueOnce(10_001); // endTime

      const context = createMockHttpContext({ method: 'GET', url: '/api/slow' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.error).toHaveBeenCalledWith(
        'intercept',
        expect.objectContaining({
          response: expect.objectContaining({ responseTime: 10_001 }),
        }),
        expect.stringContaining('SLOW REQUEST'),
      );

      jest.restoreAllMocks();
    });

    it('should not log slow request error when response time < 10s', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(9_999);

      const context = createMockHttpContext({ method: 'GET', url: '/api/fast' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.error).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should log response with exact 10s threshold as slow', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(10_000);

      const context = createMockHttpContext({ method: 'GET', url: '/api/exact' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.error).toHaveBeenCalledWith(
        'intercept',
        expect.anything(),
        expect.stringContaining('SLOW REQUEST'),
      );

      jest.restoreAllMocks();
    });

    it('should skip paths that contain skip path as substring', async () => {
      const context = createMockHttpContext({ originalUrl: '/v1/health-check?timeout=5' });

      const result = await interceptor.intercept(context, mockNext);
      await lastValueFrom(result);

      expect(loggerService.info).not.toHaveBeenCalled();
    });
  });
});
