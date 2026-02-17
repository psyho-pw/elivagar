import { LoggerService } from '@app/core/logger/logger.service';
import { faker } from '@faker-js/faker';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { TestBed, Mocked } from '@suites/unit';
import { makeUser } from '@test/factories/user.factory';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { JwtService, JwtPayload, TokenPair } from './jwt/jwt.service';
import { UserRepository } from './user/user.repository';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: Mocked<UserRepository>;
  let jwtService: Mocked<JwtService>;
  let loggerService: Mocked<LoggerService>;

  const testEmail = faker.internet.email();
  const testPassword = faker.internet.password();
  const testName = faker.person.fullName();
  const testHashedPassword = faker.string.alphanumeric(60);
  const testUserId = faker.string.uuid();
  const testAccessToken = faker.string.alphanumeric(32);
  const testRefreshToken = faker.string.alphanumeric(32);
  const unknownEmail = faker.internet.email();
  const wrongPassword = faker.internet.password();
  const validToken = faker.string.alphanumeric(32);
  const tokenNoExp = faker.string.alphanumeric(32);
  const expiredToken = faker.string.alphanumeric(32);
  const badToken = faker.string.alphanumeric(32);
  const validRefreshToken = faker.string.alphanumeric(32);
  const testTokenExp = faker.number.int({ min: 9999999999, max: 9999999999 });

  const mockUser = makeUser({
    id: testUserId,
    email: testEmail,
    password: '$2b$12$hashedPassword',
    roles: ['user'],
  });

  const mockTokenPair: TokenPair = {
    accessToken: testAccessToken,
    refreshToken: testRefreshToken,
    expiresIn: 3600,
  };

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(AuthService).compile();

    authService = unit;
    userRepository = unitRef.get(UserRepository);
    jwtService = unitRef.get(JwtService);
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should register a new user and return userId and email', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(testHashedPassword);
      userRepository.create.mockReturnValue(mockUser);

      const result = await authService.register(testEmail, testPassword, testName);

      expect(userRepository.findOne).toHaveBeenCalledWith({ email: testEmail, deletedAt: null });
      expect(bcrypt.hash).toHaveBeenCalledWith(testPassword, 12);
      expect(userRepository.create).toHaveBeenCalledWith({
        email: testEmail,
        name: testName,
        password: testHashedPassword,
        roles: ['user'],
      });
      expect(result).toEqual({ userId: testUserId, email: testEmail });
    });

    it('should throw ALREADY_EXISTS if email is already registered', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const error = await authService
        .register(testEmail, testPassword, testName)
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.ALREADY_EXISTS,
        message: 'Email already registered',
      });
    });
  });

  describe('login', () => {
    it('should return token pair on valid credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.generateTokenPair.mockReturnValue(mockTokenPair);

      const result = await authService.login(testEmail, testPassword);

      expect(userRepository.findOne).toHaveBeenCalledWith({ email: testEmail, deletedAt: null });
      expect(bcrypt.compare).toHaveBeenCalledWith(testPassword, mockUser.password);
      expect(jwtService.generateTokenPair).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        roles: mockUser.roles,
      });
      expect(result).toEqual(mockTokenPair);
    });

    it('should throw UNAUTHENTICATED when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const error = await authService
        .login(unknownEmail, testPassword)
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.UNAUTHENTICATED,
        message: 'Invalid credentials',
      });
    });

    it('should throw UNAUTHENTICATED when password is wrong', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(testEmail, wrongPassword)).rejects.toThrow(RpcException);
    });
  });

  describe('validateToken', () => {
    it('should return valid response with user data for a valid token', () => {
      const payload: JwtPayload = {
        sub: testUserId,
        email: testEmail,
        roles: ['user'],
        exp: testTokenExp,
      };
      jwtService.verifyAccessToken.mockReturnValue(payload);

      const result = authService.validateToken(validToken);

      expect(result.valid).toBe(true);
      expect(result.user).toEqual({
        userId: testUserId,
        email: testEmail,
        roles: ['user'],
        tokenExp: testTokenExp,
        tokenHash: JwtService.hashToken(validToken),
      });
      expect(result.errorMessage).toBe('');
    });

    it('should return tokenExp 0 when payload has no exp', () => {
      const payload: JwtPayload = {
        sub: testUserId,
        email: testEmail,
        roles: ['user'],
      };
      jwtService.verifyAccessToken.mockReturnValue(payload);

      const result = authService.validateToken(tokenNoExp);
      expect(result.user!.tokenExp).toBe(0);
    });

    it('should return invalid response when token verification fails', () => {
      jwtService.verifyAccessToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = authService.validateToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.errorMessage).toBe('jwt expired');
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should return "Invalid token" for non-Error thrown values', () => {
      jwtService.verifyAccessToken.mockImplementation(() => {
        throw 'some string error';
      });

      const result = authService.validateToken(badToken);

      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Invalid token');
    });
  });

  describe('refreshToken', () => {
    it('should return a new token pair for a valid refresh token', async () => {
      jwtService.verifyRefreshToken.mockReturnValue({ sub: testUserId });
      userRepository.findOne.mockResolvedValue(mockUser);
      jwtService.generateTokenPair.mockReturnValue(mockTokenPair);

      const result = await authService.refreshToken(validRefreshToken);

      expect(jwtService.verifyRefreshToken).toHaveBeenCalledWith(validRefreshToken);
      expect(userRepository.findOne).toHaveBeenCalledWith({ id: testUserId, deletedAt: null });
      expect(result).toEqual(mockTokenPair);
    });

    it('should throw NOT_FOUND when user no longer exists', async () => {
      const nonExistentUserId = faker.string.uuid();
      jwtService.verifyRefreshToken.mockReturnValue({ sub: nonExistentUserId });
      userRepository.findOne.mockResolvedValue(null);

      const error = await authService.refreshToken(validRefreshToken).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.NOT_FOUND,
        message: 'User not found',
      });
    });

    it('should throw UNAUTHENTICATED when refresh token is invalid', async () => {
      const invalidToken = faker.string.alphanumeric(32);
      jwtService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const error = await authService.refreshToken(invalidToken).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.UNAUTHENTICATED,
        message: 'Invalid refresh token',
      });
    });

    it('should re-throw RpcException as-is without wrapping', async () => {
      jwtService.verifyRefreshToken.mockReturnValue({ sub: testUserId });
      userRepository.findOne.mockResolvedValue(null);

      const error = await authService.refreshToken(validRefreshToken).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.NOT_FOUND,
        message: 'User not found',
      });
    });
  });
});
