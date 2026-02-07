import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { Mocked, TestBed } from '@suites/unit';
import {
  Configs,
  IApp,
  IAuthGrpcConfig,
  IDatabase,
  IDiscordConfig,
  IKafkaConfig,
  IRedisConfig,
  IYoutubeConfig,
} from './configs.interface';
import { ConfigsService } from './configs.service';
import { AppConfigKey } from './configurations/app.config';
import { AuthGrpcConfigKey } from './configurations/auth-grpc.config';
import { DatabaseConfigKey } from './configurations/database.config';
import { DiscordConfigKey } from './configurations/discord.config';
import { KafkaConfigKey } from './configurations/kafka.config';
import { RedisConfigKey } from './configurations/redis.config';
import { YoutubeConfigKey } from './configurations/youtube.config';

describe('ConfigsService', () => {
  let service: ConfigsService;
  let configService: Mocked<ConfigService<Configs>>;

  const mockAppConfig: IApp = {
    env: 'test',
    port: faker.internet.port(),
    grpcPort: faker.internet.port(),
    serviceName: faker.word.noun(),
    jwtSecret: faker.string.alphanumeric(32),
    jwtRefreshSecret: faker.string.alphanumeric(32),
    jwtAlgorithm: 'HS256',
    jwtExpire: faker.number.int({ min: 3600, max: 86400 }),
    jwtRefreshExpire: faker.number.int({ min: 86400, max: 604800 }),
    jwtIssuer: faker.word.noun(),
    clientURI: faker.internet.url(),
  } as IApp;

  const mockDatabaseConfig: IDatabase = {
    host: 'localhost',
    port: faker.internet.port(),
    user: faker.word.noun(),
    password: faker.internet.password(),
    dbName: faker.word.noun(),
  } as IDatabase;

  const mockRedisConfig: IRedisConfig = {
    host: 'localhost',
    port: faker.internet.port(),
  };

  const mockKafkaConfig: IKafkaConfig = {
    brokers: [`localhost:${faker.internet.port()}`],
    clientId: faker.word.noun(),
    groupId: `${faker.word.noun()}-group`,
    ssl: faker.datatype.boolean(),
  } as IKafkaConfig;

  const mockDiscordConfig: IDiscordConfig = {
    token: faker.string.alphanumeric(32),
    clientId: faker.string.alphanumeric(32),
    guildId: faker.string.alphanumeric(32),
    commandPrefix: '!',
    messageDeleteTimeout: faker.number.int({ min: 5000, max: 10000 }),
    webhookUrl: faker.internet.url(),
  };

  const mockYoutubeConfig: IYoutubeConfig = {
    youtubeApiKey: faker.string.alphanumeric(32),
  };

  const mockAuthGrpcConfig: IAuthGrpcConfig = {
    url: `localhost:${faker.internet.port()}`,
  };

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(ConfigsService).compile();
    service = unit;
    configService = unitRef.get(ConfigService);
  });

  beforeEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('AppConfig', () => {
    it('should return app config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockAppConfig);
      expect(service.AppConfig).toEqual(mockAppConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(AppConfigKey, { infer: true });
    });

    it('should throw when app config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.AppConfig).toThrow('Config not found');
    });
  });

  describe('DatabaseConfig', () => {
    it('should return database config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockDatabaseConfig);
      expect(service.DatabaseConfig).toEqual(mockDatabaseConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(DatabaseConfigKey, { infer: true });
    });

    it('should throw when database config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.DatabaseConfig).toThrow('Config not found');
    });
  });

  describe('RedisConfig', () => {
    it('should return redis config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockRedisConfig);
      expect(service.RedisConfig).toEqual(mockRedisConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(RedisConfigKey, { infer: true });
    });

    it('should throw when redis config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.RedisConfig).toThrow('Config not found');
    });
  });

  describe('KafkaConfig', () => {
    it('should return kafka config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockKafkaConfig);
      expect(service.KafkaConfig).toEqual(mockKafkaConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(KafkaConfigKey, { infer: true });
    });

    it('should throw when kafka config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.KafkaConfig).toThrow('Config not found');
    });
  });

  describe('DiscordConfig', () => {
    it('should return discord config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockDiscordConfig);
      expect(service.DiscordConfig).toEqual(mockDiscordConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(DiscordConfigKey, { infer: true });
    });

    it('should throw when discord config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.DiscordConfig).toThrow('Config not found');
    });
  });

  describe('YoutubeConfig', () => {
    it('should return youtube config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockYoutubeConfig);
      expect(service.YoutubeConfig).toEqual(mockYoutubeConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(YoutubeConfigKey, { infer: true });
    });

    it('should throw when youtube config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.YoutubeConfig).toThrow('Config not found');
    });
  });

  describe('AuthGrpcConfig', () => {
    it('should return auth grpc config from ConfigService', () => {
      configService.getOrThrow.mockReturnValue(mockAuthGrpcConfig);
      expect(service.AuthGrpcConfig).toEqual(mockAuthGrpcConfig);
      expect(configService.getOrThrow).toHaveBeenCalledWith(AuthGrpcConfigKey, { infer: true });
    });

    it('should throw when auth grpc config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.AuthGrpcConfig).toThrow('Config not found');
    });
  });
});
