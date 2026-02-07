jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid-v7'),
}));

import { ExecutionContext } from '@nestjs/common';
import { TestBed, Mocked } from '@suites/unit';
import { createMockExecutionContext } from '@test/factories/execution-context.factory';
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

  describe('canActivate', () => {
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

    it('should generate UUID v7 when no x-request-id header is present', () => {
      const context = createMockHttpContext({});

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(clsService.requestId).toBe('mock-uuid-v7');
    });

    it('should generate UUID v7 when x-request-id header is empty string', () => {
      const context = createMockHttpContext({ 'x-request-id': '' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(clsService.requestId).toBe('mock-uuid-v7');
    });

    it('should return true for non-http context without setting requestId', () => {
      const context = {
        getType: () => 'rpc',
      } as unknown as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
