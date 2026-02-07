import { faker } from '@faker-js/faker';
import { Metadata, ServerUnaryCall } from '@grpc/grpc-js';
import { TestBed, Mocked } from '@suites/unit';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Mocked<AuthService>;

  const testEmail = faker.internet.email();
  const testPassword = faker.internet.password();
  const testName = faker.person.fullName();
  const testUserId = faker.string.uuid();
  const testAccessToken = faker.string.alphanumeric(32);
  const testRefreshToken = faker.string.alphanumeric(32);
  const testNewAccessToken = faker.string.alphanumeric(32);
  const testNewRefreshToken = faker.string.alphanumeric(32);
  const testToken = faker.string.alphanumeric(32);

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(AuthController).compile();

    controller = unit;
    authService = unitRef.get(AuthService);
  });

  beforeEach(() => jest.clearAllMocks());

  // The @TransformDto() decorator intercepts (data, metadata, call) and
  // repackages them as { data, metadata, call }. So we pass raw gRPC-style args.
  const mockMetadata = {} as Metadata;
  const mockCall = {} as ServerUnaryCall<unknown, unknown>;

  describe('Register', () => {
    it('should delegate to authService.register with email and password', async () => {
      const expected = { userId: testUserId, email: testEmail };
      authService.register.mockResolvedValue(expected);

      const data = { email: testEmail, password: testPassword, name: testName };
      const register = controller.Register as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await register.call(controller, data, mockMetadata, mockCall);

      expect(authService.register).toHaveBeenCalledWith(testEmail, testPassword, testName);
      expect(result).toEqual(expected);
    });
  });

  describe('Login', () => {
    it('should delegate to authService.login with email and password', async () => {
      const expected = {
        accessToken: testAccessToken,
        refreshToken: testRefreshToken,
        expiresIn: 3600,
      };
      authService.login.mockResolvedValue(expected);

      const data = { email: testEmail, password: testPassword };
      const login = controller.Login as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await login.call(controller, data, mockMetadata, mockCall);

      expect(authService.login).toHaveBeenCalledWith(testEmail, testPassword);
      expect(result).toEqual(expected);
    });
  });

  describe('ValidateToken', () => {
    it('should delegate to authService.validateToken with token', () => {
      const expected = {
        valid: true,
        user: {
          userId: testUserId,
          email: testEmail,
          roles: ['user'],
          tokenExp: 9999999999,
          tokenHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
        },
        errorMessage: '',
      };
      authService.validateToken.mockReturnValue(expected);

      const data = { token: testToken };
      const validateToken = controller.ValidateToken as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => unknown;
      const result = validateToken.call(controller, data, mockMetadata, mockCall);

      expect(authService.validateToken).toHaveBeenCalledWith(testToken);
      expect(result).toEqual(expected);
    });
  });

  describe('RefreshToken', () => {
    it('should delegate to authService.refreshToken with refresh token', async () => {
      const expected = {
        accessToken: testNewAccessToken,
        refreshToken: testNewRefreshToken,
        expiresIn: 3600,
      };
      authService.refreshToken.mockResolvedValue(expected);

      const data = { refreshToken: testRefreshToken };
      const refreshToken = controller.RefreshToken as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await refreshToken.call(controller, data, mockMetadata, mockCall);

      expect(authService.refreshToken).toHaveBeenCalledWith(testRefreshToken);
      expect(result).toEqual(expected);
    });
  });
});
