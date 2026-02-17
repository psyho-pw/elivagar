import { createHash } from 'crypto';
import { CacheServiceKey } from '@app/cache/cache.constant';
import { ICacheService } from '@app/cache/cache.interface';
import { AuthUser, IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import { LoggerService } from '@app/core/logger/logger.service';
import { faker } from '@faker-js/faker';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TestBed, Mocked } from '@suites/unit';
import { createMockExecutionContext } from '@test/factories/execution-context.factory';
import { AuthGrpcClientService } from './auth-grpc-client.service';
import { AUTH_TOKEN_CACHE_PREFIX, AUTH_TOKEN_MAX_CACHE_TTL, IS_PUBLIC_KEY } from './auth.constant';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Mocked<Reflector>;
  let authGrpcClient: Mocked<AuthGrpcClientService>;
  let cacheService: Mocked<ICacheService>;
  let clsService: Mocked<IClsService>;
  let loggerService: Mocked<LoggerService>;

  const mockUserId = faker.string.uuid();
  const mockEmail = faker.internet.email();
  const mockRole = faker.word.noun();
  const mockTokenHash = faker.string.hexadecimal({ length: 64, prefix: '' });
  const mockTokenExp = faker.number.int({ min: 9999999990, max: 9999999999 });

  const mockUser: AuthUser = {
    userId: mockUserId,
    email: mockEmail,
    roles: [mockRole],
    tokenHash: mockTokenHash,
    tokenExp: mockTokenExp,
  };

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(AuthGuard).compile();

    guard = unit;
    reflector = unitRef.get(Reflector);
    authGrpcClient = unitRef.get(AuthGrpcClientService);
    cacheService = unitRef.get(CacheServiceKey);
    clsService = unitRef.get(ClsServiceKey);
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  function createMockHttpContext(headers: Record<string, string> = {}): ExecutionContext {
    return createMockExecutionContext({
      request: { headers } as Record<string, unknown>,
    });
  }

  describe('canActivate', () => {
    it('should return true when route is marked @Public()', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockHttpContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(authGrpcClient.validateToken).not.toHaveBeenCalled();
    });

    it('should return true for rpc context type (internal gRPC)', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = {
        getType: () => 'rpc',
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access and log warning for unknown context types', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = {
        getType: () => 'ws',
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(loggerService.warn).toHaveBeenCalledWith(
        'canActivate',
        'Unexpected context type: ws, denying access',
      );
    });

    it('should throw UnauthorizedException when no authorization header', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockHttpContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Missing authorization token'),
      );
    });

    it('should throw UnauthorizedException when authorization header has no Bearer prefix', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockHttpContext({ authorization: `Basic ${token}` });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Missing authorization token'),
      );
    });

    it('should throw UnauthorizedException when Bearer token is empty', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockHttpContext({ authorization: 'Bearer ' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Missing authorization token'),
      );
    });

    it('should return cached user without calling gRPC when cache hit', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(mockUser);
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      const result = await guard.canActivate(context);

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expectedCacheKey = `${AUTH_TOKEN_CACHE_PREFIX}:${tokenHash}`;

      expect(result).toBe(true);
      expect(cacheService.get).toHaveBeenCalledWith(expectedCacheKey);
      expect(authGrpcClient.validateToken).not.toHaveBeenCalled();
    });

    it('should set user on request and CLS from cache', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(mockUser);
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(mockUser);
      expect(clsService.user).toEqual(mockUser);
    });

    it('should call gRPC validateToken on cache miss', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      authGrpcClient.validateToken.mockResolvedValue({
        valid: true,
        user: mockUser,
        errorMessage: '',
      });
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(authGrpcClient.validateToken).toHaveBeenCalledWith(token);
    });

    it('should cache user after successful gRPC validation', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      authGrpcClient.validateToken.mockResolvedValue({
        valid: true,
        user: mockUser,
        errorMessage: '',
      });
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await guard.canActivate(context);

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expectedCacheKey = `${AUTH_TOKEN_CACHE_PREFIX}:${tokenHash}`;
      expect(cacheService.set).toHaveBeenCalledWith(
        expectedCacheKey,
        mockUser,
        AUTH_TOKEN_MAX_CACHE_TTL,
      );
    });

    it('should set user on request and CLS after gRPC validation', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      authGrpcClient.validateToken.mockResolvedValue({
        valid: true,
        user: mockUser,
        errorMessage: '',
      });
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(mockUser);
      expect(clsService.user).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when gRPC returns invalid token', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      authGrpcClient.validateToken.mockResolvedValue({
        valid: false,
        user: undefined,
        errorMessage: 'Token expired',
      });
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should throw UnauthorizedException when gRPC returns valid but no user', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      authGrpcClient.validateToken.mockResolvedValue({
        valid: true,
        user: undefined,
        errorMessage: '',
      });
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should throw UnauthorizedException with service unavailable message on gRPC error', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      authGrpcClient.validateToken.mockRejectedValue(new Error('gRPC connection refused'));
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Authentication service unavailable'),
      );
      expect(loggerService.error).toHaveBeenCalledWith(
        'canActivate',
        expect.any(Error),
        'Auth gRPC call failed',
      );
    });

    it('should re-throw UnauthorizedException from gRPC call without wrapping', async () => {
      const token = faker.string.alphanumeric(32);
      reflector.getAllAndOverride.mockReturnValue(false);
      cacheService.get.mockResolvedValue(undefined);
      const originalError = new UnauthorizedException('Token revoked');
      authGrpcClient.validateToken.mockRejectedValue(originalError);
      const context = createMockHttpContext({
        authorization: `Bearer ${token}`,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(originalError);
      expect(loggerService.error).not.toHaveBeenCalled();
    });
  });
});
