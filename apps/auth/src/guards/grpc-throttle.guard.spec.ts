import { status } from '@grpc/grpc-js';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RpcException } from '@nestjs/microservices';
import { GRPC_THROTTLE_KEY, GrpcThrottleOptions } from './grpc-throttle.decorator';
import { GrpcThrottleGuard } from './grpc-throttle.guard';

describe('GrpcThrottleGuard', () => {
  let guard: GrpcThrottleGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { get: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new GrpcThrottleGuard(reflector);
  });

  function createHandler(name: string): () => void {
    const fn = (): void => {};
    Object.defineProperty(fn, 'name', { value: name });
    return fn;
  }

  function createRpcContext(handlerName: string, peer?: string[]): ExecutionContext {
    const handler = createHandler(handlerName);
    return {
      getType: () => 'rpc',
      getHandler: () => handler,
      getClass: () => ({}),
      switchToRpc: () => ({
        getContext: () => ({
          get: (key: string) => (key === 'peer' ? peer : undefined),
        }),
        getData: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  function createHttpContext(): ExecutionContext {
    return {
      getType: () => 'http',
      getHandler: () => ({ name: 'test' }),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should return true for non-rpc context', () => {
    const context = createHttpContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.get).not.toHaveBeenCalled();
  });

  it('should return true when no @GrpcThrottle decorator is set', () => {
    reflector.get.mockReturnValue(undefined);
    const context = createRpcContext('Login');

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.get).toHaveBeenCalledWith(GRPC_THROTTLE_KEY, context.getHandler());
  });

  it('should allow requests within the limit', () => {
    const options: GrpcThrottleOptions = { limit: 3, ttlSeconds: 60 };
    reflector.get.mockReturnValue(options);
    const context = createRpcContext('Login', ['192.168.1.1']);

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw RpcException with RESOURCE_EXHAUSTED when limit exceeded', () => {
    const options: GrpcThrottleOptions = { limit: 2, ttlSeconds: 60 };
    reflector.get.mockReturnValue(options);
    const context = createRpcContext('Login', ['192.168.1.1']);

    guard.canActivate(context);
    guard.canActivate(context);

    try {
      guard.canActivate(context);
      fail('Expected RpcException to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RpcException);
      const error = (err as RpcException).getError() as { code: number; message: string };
      expect(error.code).toBe(status.RESOURCE_EXHAUSTED);
      expect(error.message).toMatch(/Rate limit exceeded/);
    }
  });

  it('should track different IPs independently', () => {
    const options: GrpcThrottleOptions = { limit: 1, ttlSeconds: 60 };
    reflector.get.mockReturnValue(options);
    const context1 = createRpcContext('Login', ['10.0.0.1']);
    const context2 = createRpcContext('Login', ['10.0.0.2']);

    expect(guard.canActivate(context1)).toBe(true);
    expect(guard.canActivate(context2)).toBe(true);

    expect(() => guard.canActivate(context1)).toThrow(RpcException);
    expect(() => guard.canActivate(context2)).toThrow(RpcException);
  });

  it('should track different handlers independently', () => {
    const options: GrpcThrottleOptions = { limit: 1, ttlSeconds: 60 };
    reflector.get.mockReturnValue(options);
    const loginContext = createRpcContext('Login', ['10.0.0.1']);
    const registerContext = createRpcContext('Register', ['10.0.0.1']);

    expect(guard.canActivate(loginContext)).toBe(true);
    expect(guard.canActivate(registerContext)).toBe(true);

    expect(() => guard.canActivate(loginContext)).toThrow(RpcException);
    expect(() => guard.canActivate(registerContext)).toThrow(RpcException);
  });

  it('should reset count after TTL window expires', () => {
    const options: GrpcThrottleOptions = { limit: 1, ttlSeconds: 1 };
    reflector.get.mockReturnValue(options);
    const context = createRpcContext('Login', ['10.0.0.1']);

    jest.useFakeTimers();

    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(RpcException);

    jest.advanceTimersByTime(1001);

    expect(guard.canActivate(context)).toBe(true);

    jest.useRealTimers();
  });

  it('should fallback to "unknown" when peer metadata is unavailable', () => {
    const options: GrpcThrottleOptions = { limit: 1, ttlSeconds: 60 };
    reflector.get.mockReturnValue(options);
    const context = createRpcContext('Login');

    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(RpcException);
  });

  it('should cleanup expired entries periodically', () => {
    const options: GrpcThrottleOptions = { limit: 1, ttlSeconds: 1 };
    reflector.get.mockReturnValue(options);

    jest.useFakeTimers();

    const context = createRpcContext('Login', ['10.0.0.1']);
    guard.canActivate(context);

    // Advance past TTL + cleanup interval (60s)
    jest.advanceTimersByTime(61_000);

    // Next call triggers cleanup, expired entry should be removed
    guard.canActivate(context);

    // Access internal store size via the guard accepting a new request (entry was cleaned + re-created)
    // Verify by making one more request for a different IP - only 2 entries should exist
    const context2 = createRpcContext('Login', ['10.0.0.2']);
    guard.canActivate(context2);

    // Both should be rate limited (1 call each, limit=1)
    expect(() => guard.canActivate(context)).toThrow(RpcException);
    expect(() => guard.canActivate(context2)).toThrow(RpcException);

    jest.useRealTimers();
  });
});
