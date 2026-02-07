import { createHash } from 'crypto';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { faker } from '@faker-js/faker';
import { TestBed, Mocked } from '@suites/unit';
import * as jwt from 'jsonwebtoken';
import { JwtService, JwtPayload } from './jwt.service';

describe('JwtService', () => {
  let jwtService: JwtService;
  let _configsService: Mocked<IConfigsService>;

  const appConfig = {
    jwtSecret: 'test-access-secret',
    jwtRefreshSecret: 'test-refresh-secret',
    jwtAlgorithm: 'HS256' as const,
    jwtExpire: 3600,
    jwtRefreshExpire: 86400,
    jwtIssuer: 'test-issuer',
  };

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(JwtService)
      .mock(ConfigsServiceKey)
      .impl(() => ({
        AppConfig: appConfig,
      }))
      .compile();

    jwtService = unit;
    _configsService = unitRef.get(ConfigsServiceKey);
  });

  describe('generateTokenPair', () => {
    const testUserId = faker.string.uuid();
    const testEmail = faker.internet.email();
    const testRole = faker.helpers.arrayElement(['user', 'admin', 'moderator']);

    const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
      sub: testUserId,
      email: testEmail,
      roles: [testRole],
    };

    it('should return an access token, refresh token, and expiresIn', () => {
      const result = jwtService.generateTokenPair(payload);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.expiresIn).toBe(3600);
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should produce a valid access token with correct payload', () => {
      const result = jwtService.generateTokenPair(payload);
      const decoded = jwt.verify(result.accessToken, appConfig.jwtSecret, {
        algorithms: [appConfig.jwtAlgorithm],
      }) as jwt.JwtPayload;

      expect(decoded.sub).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.roles).toEqual([testRole]);
      expect(decoded.iss).toBe('test-issuer');
    });

    it('should produce a refresh token containing only sub', () => {
      const result = jwtService.generateTokenPair(payload);
      const decoded = jwt.verify(result.refreshToken, appConfig.jwtRefreshSecret, {
        algorithms: [appConfig.jwtAlgorithm],
      }) as jwt.JwtPayload;

      expect(decoded.sub).toBe(testUserId);
      expect(decoded.email).toBeUndefined();
      expect(decoded.roles).toBeUndefined();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and return a valid access token payload', () => {
      const testUserId = faker.string.uuid();
      const testEmail = faker.internet.email();
      const token = jwt.sign(
        { sub: testUserId, email: testEmail, roles: ['admin'] },
        appConfig.jwtSecret,
        { algorithm: appConfig.jwtAlgorithm, issuer: appConfig.jwtIssuer },
      );

      const result = jwtService.verifyAccessToken(token);

      expect(result.sub).toBe(testUserId);
      expect(result.email).toBe(testEmail);
      expect(result.roles).toEqual(['admin']);
    });

    it('should throw on an expired token', () => {
      const testUserId = faker.string.uuid();
      const testEmail = faker.internet.email();
      const token = jwt.sign(
        { sub: testUserId, email: testEmail, roles: ['user'] },
        appConfig.jwtSecret,
        { algorithm: appConfig.jwtAlgorithm, issuer: appConfig.jwtIssuer, expiresIn: -1 },
      );

      expect(() => jwtService.verifyAccessToken(token)).toThrow();
    });

    it('should throw on an invalid signature', () => {
      const testUserId = faker.string.uuid();
      const token = jwt.sign({ sub: testUserId }, 'wrong-secret', {
        algorithm: appConfig.jwtAlgorithm,
        issuer: appConfig.jwtIssuer,
      });

      expect(() => jwtService.verifyAccessToken(token)).toThrow();
    });

    it('should reject a token signed with the refresh secret', () => {
      const token = jwt.sign(
        { sub: faker.string.uuid(), email: faker.internet.email(), roles: ['user'] },
        appConfig.jwtRefreshSecret,
        { algorithm: appConfig.jwtAlgorithm, issuer: appConfig.jwtIssuer },
      );

      expect(() => jwtService.verifyAccessToken(token)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and return the sub from a valid refresh token', () => {
      const testUserId = faker.string.uuid();
      const token = jwt.sign({ sub: testUserId }, appConfig.jwtRefreshSecret, {
        algorithm: appConfig.jwtAlgorithm,
        issuer: appConfig.jwtIssuer,
      });

      const result = jwtService.verifyRefreshToken(token);
      expect(result.sub).toBe(testUserId);
    });

    it('should throw on an invalid refresh token', () => {
      const testUserId = faker.string.uuid();
      const token = jwt.sign({ sub: testUserId }, 'wrong-refresh-secret', {
        algorithm: appConfig.jwtAlgorithm,
        issuer: appConfig.jwtIssuer,
      });

      expect(() => jwtService.verifyRefreshToken(token)).toThrow();
    });

    it('should reject a token signed with the access secret', () => {
      const token = jwt.sign({ sub: faker.string.uuid() }, appConfig.jwtSecret, {
        algorithm: appConfig.jwtAlgorithm,
        issuer: appConfig.jwtIssuer,
      });

      expect(() => jwtService.verifyRefreshToken(token)).toThrow();
    });
  });

  describe('hashToken', () => {
    it('should return a SHA-256 hex hash of the token', () => {
      const token = faker.string.alphanumeric(32);
      const expected = createHash('sha256').update(token).digest('hex');

      expect(JwtService.hashToken(token)).toBe(expected);
    });

    it('should produce different hashes for different tokens', () => {
      const tokenA = faker.string.alphanumeric(32);
      const tokenB = faker.string.alphanumeric(32);
      const hash1 = JwtService.hashToken(tokenA);
      const hash2 = JwtService.hashToken(tokenB);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce a 64-character hex string', () => {
      const token = faker.string.alphanumeric(16);
      const hash = JwtService.hashToken(token);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
