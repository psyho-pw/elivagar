import { Metadata } from '@grpc/grpc-js';
import { ExecutionContext } from '@nestjs/common';
import { TestBed, Mocked } from '@suites/unit';
import { createMockExecutionContext } from '@test/factories/execution-context.factory';
import { MOCK_UUID_V7 } from '@test/mocks/uuid.mock';
import { RequestIdGuard } from './cls.guard';
import { IClsService } from '../../cls/cls.interface';
import { ClsServiceKey } from '../../cls/cls.module';

describe('RequestIdGuard', () => {
  let guard: RequestIdGuard;
  let clsService: Mocked<IClsService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(RequestIdGuard).compile();

    guard = unit;
    clsService = unitRef.get(ClsServiceKey);
  });

  beforeEach(() => jest.clearAllMocks());

  function createMockHttpContext(headers: Record<string, string> = {}): ExecutionContext {
    return createMockExecutionContext({
      request: { headers, requestId: undefined as string | undefined },
    });
  }

  function createGrpcMetadata(headers?: Record<string, string>): Metadata {
    const metadata = new Metadata();
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        metadata.set(key, value);
      }
    }
    return metadata;
  }

  function createMockGrpcContext(metadata?: Metadata): ExecutionContext {
    return createMockExecutionContext({
      type: 'rpc',
      rpcContext: metadata ?? new Metadata(),
    });
  }

  function createMockKafkaContext(headers?: Record<string, string | Buffer>): ExecutionContext {
    return createMockExecutionContext({
      type: 'rpc',
      rpcContext: {
        getTopic: () => 'test.topic',
        getMessage: () => ({ headers: headers ?? {} }),
      },
    });
  }

  describe('canActivate', () => {
    describe('HTTP transport', () => {
      it('should extract x-request-id from headers and set it on CLS', () => {
        const context = createMockHttpContext({ 'x-request-id': 'existing-request-id' });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe('existing-request-id');
      });

      it('should set x-request-id on the request object', () => {
        const context = createMockHttpContext({ 'x-request-id': 'existing-request-id' });

        guard.canActivate(context);

        const request = context.switchToHttp().getRequest();
        expect(request.requestId).toBe('existing-request-id');
      });

      it('should set startTime on the request object', () => {
        const context = createMockHttpContext({ 'x-request-id': 'test-id' });

        guard.canActivate(context);

        const request = context.switchToHttp().getRequest();
        expect(request.startTime).toEqual(expect.any(Number));
      });

      it('should generate UUID v7 when no x-request-id header is present', () => {
        const context = createMockHttpContext({});

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe(MOCK_UUID_V7);
      });

      it('should generate UUID v7 when x-request-id header is empty string', () => {
        const context = createMockHttpContext({ 'x-request-id': '' });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe(MOCK_UUID_V7);
      });
    });

    describe('gRPC transport', () => {
      it('should extract x-request-id from gRPC metadata', () => {
        const metadata = createGrpcMetadata({ 'x-request-id': 'grpc-request-id' });
        const context = createMockGrpcContext(metadata);

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe('grpc-request-id');
      });

      it('should generate UUID v7 when gRPC metadata has no x-request-id', () => {
        const context = createMockGrpcContext();

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe(MOCK_UUID_V7);
      });
    });

    describe('Kafka transport', () => {
      it('should extract x-request-id from Kafka message headers (string)', () => {
        const context = createMockKafkaContext({ 'x-request-id': 'kafka-request-id' });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe('kafka-request-id');
      });

      it('should extract x-request-id from Kafka message headers (Buffer)', () => {
        const context = createMockKafkaContext({
          'x-request-id': Buffer.from('kafka-buffer-id'),
        });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe('kafka-buffer-id');
      });

      it('should generate UUID v7 when Kafka message has no x-request-id header', () => {
        const context = createMockKafkaContext({});

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe(MOCK_UUID_V7);
      });
    });

    describe('common behavior across transports', () => {
      it('should set controllerCtx and methodCtx for HTTP', () => {
        const context = createMockHttpContext();

        guard.canActivate(context);

        expect(clsService.controllerCtx).toBe('TestController');
        expect(clsService.methodCtx).toBe('testMethod');
      });

      it('should set controllerCtx and methodCtx for gRPC', () => {
        const context = createMockGrpcContext();

        guard.canActivate(context);

        expect(clsService.controllerCtx).toBe('TestController');
        expect(clsService.methodCtx).toBe('testMethod');
      });

      it('should set controllerCtx and methodCtx for Kafka', () => {
        const context = createMockKafkaContext();

        guard.canActivate(context);

        expect(clsService.controllerCtx).toBe('TestController');
        expect(clsService.methodCtx).toBe('testMethod');
      });

      it('should generate UUID v7 for unknown transport type', () => {
        const context = createMockExecutionContext({ type: 'ws' });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(clsService.requestId).toBe(MOCK_UUID_V7);
      });
    });
  });
});
