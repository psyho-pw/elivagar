import { getServicePrefix, getEnv, getEnvInt, getEnvBool } from './configs.helper';

describe('configs.helper', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getServicePrefix', () => {
    it('should return empty string when SERVICE_NAME is not set', () => {
      delete process.env.SERVICE_NAME;
      expect(getServicePrefix()).toBe('');
    });

    it('should return empty string when SERVICE_NAME is empty', () => {
      process.env.SERVICE_NAME = '';
      expect(getServicePrefix()).toBe('');
    });

    it('should convert "auth" to "AUTH_"', () => {
      process.env.SERVICE_NAME = 'auth';
      expect(getServicePrefix()).toBe('AUTH_');
    });

    it('should convert "notification" to "NOTIFICATION_"', () => {
      process.env.SERVICE_NAME = 'notification';
      expect(getServicePrefix()).toBe('NOTIFICATION_');
    });

    it('should convert "sayho-bot" to "SAYHO_BOT_"', () => {
      process.env.SERVICE_NAME = 'sayho-bot';
      expect(getServicePrefix()).toBe('SAYHO_BOT_');
    });

    it('should handle multiple hyphens correctly', () => {
      process.env.SERVICE_NAME = 'my-cool-service';
      expect(getServicePrefix()).toBe('MY_COOL_SERVICE_');
    });
  });

  describe('getEnv', () => {
    it('should return prefixed env variable when both prefixed and non-prefixed exist', () => {
      process.env.SERVICE_NAME = 'auth';
      process.env.AUTH_PORT = '4000';
      process.env.PORT = '3000';
      expect(getEnv('PORT')).toBe('4000');
    });

    it('should fall back to non-prefixed env variable when prefixed does not exist', () => {
      process.env.SERVICE_NAME = 'auth';
      delete process.env.AUTH_PORT;
      process.env.PORT = '3000';
      expect(getEnv('PORT')).toBe('3000');
    });

    it('should return default value when neither prefixed nor non-prefixed exist', () => {
      process.env.SERVICE_NAME = 'auth';
      delete process.env.AUTH_PORT;
      delete process.env.PORT;
      expect(getEnv('PORT', '8080')).toBe('8080');
    });

    it('should return empty string when no env var and no default', () => {
      process.env.SERVICE_NAME = 'auth';
      delete process.env.AUTH_MISSING;
      delete process.env.MISSING;
      expect(getEnv('MISSING')).toBe('');
    });

    it('should return non-prefixed variable when SERVICE_NAME is not set', () => {
      delete process.env.SERVICE_NAME;
      process.env.PORT = '3000';
      expect(getEnv('PORT')).toBe('3000');
    });

    it('should return prefixed value even when it is an empty string', () => {
      process.env.SERVICE_NAME = 'auth';
      process.env.AUTH_HOST = '';
      process.env.HOST = 'localhost';
      expect(getEnv('HOST')).toBe('');
    });

    it('should return non-prefixed value even when it is an empty string', () => {
      process.env.SERVICE_NAME = 'auth';
      delete process.env.AUTH_HOST;
      process.env.HOST = '';
      expect(getEnv('HOST')).toBe('');
    });
  });

  describe('getEnvInt', () => {
    it('should parse integer from environment variable', () => {
      process.env.SERVICE_NAME = 'auth';
      process.env.AUTH_PORT = '4000';
      expect(getEnvInt('PORT')).toBe(4000);
    });

    it('should return default value when env var is not set', () => {
      delete process.env.SERVICE_NAME;
      delete process.env.PORT;
      expect(getEnvInt('PORT', 3000)).toBe(3000);
    });

    it('should return 0 when env var is not set and no default provided', () => {
      delete process.env.SERVICE_NAME;
      delete process.env.PORT;
      expect(getEnvInt('PORT')).toBe(0);
    });

    it('should return default value when env var is not a valid integer', () => {
      delete process.env.SERVICE_NAME;
      process.env.PORT = 'abc';
      expect(getEnvInt('PORT', 3000)).toBe(3000);
    });

    it('should return 0 when env var is not a valid integer and no default', () => {
      delete process.env.SERVICE_NAME;
      process.env.PORT = 'abc';
      expect(getEnvInt('PORT')).toBe(0);
    });

    it('should parse negative integers', () => {
      delete process.env.SERVICE_NAME;
      process.env.OFFSET = '-5';
      expect(getEnvInt('OFFSET')).toBe(-5);
    });
  });

  describe('getEnvBool', () => {
    it('should return true for "true"', () => {
      delete process.env.SERVICE_NAME;
      process.env.SSL = 'true';
      expect(getEnvBool('SSL')).toBe(true);
    });

    it('should return true for "1"', () => {
      delete process.env.SERVICE_NAME;
      process.env.SSL = '1';
      expect(getEnvBool('SSL')).toBe(true);
    });

    it('should return false for "false"', () => {
      delete process.env.SERVICE_NAME;
      process.env.SSL = 'false';
      expect(getEnvBool('SSL')).toBe(false);
    });

    it('should return false for "0"', () => {
      delete process.env.SERVICE_NAME;
      process.env.SSL = '0';
      expect(getEnvBool('SSL')).toBe(false);
    });

    it('should return false for arbitrary string', () => {
      delete process.env.SERVICE_NAME;
      process.env.SSL = 'yes';
      expect(getEnvBool('SSL')).toBe(false);
    });

    it('should return false when env var is not set and no default', () => {
      delete process.env.SERVICE_NAME;
      delete process.env.SSL;
      expect(getEnvBool('SSL')).toBe(false);
    });

    it('should use default value when env var is not set', () => {
      delete process.env.SERVICE_NAME;
      delete process.env.SSL;
      expect(getEnvBool('SSL', true)).toBe(true);
    });
  });
});
