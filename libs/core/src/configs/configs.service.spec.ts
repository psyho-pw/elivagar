import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { Mocked, TestBed } from '@suites/unit';
import { IApp, IDatabase } from './configs.interface';
import { ConfigsService } from './configs.service';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';

describe('ConfigsService', () => {
  let service: ConfigsService;
  let configService: Mocked<ConfigService>;

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
      expect(configService.getOrThrow).toHaveBeenCalledWith(AppConfigKey);
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
      expect(configService.getOrThrow).toHaveBeenCalledWith(DatabaseConfigKey);
    });

    it('should throw when database config is not loaded', () => {
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config not found');
      });
      expect(() => service.DatabaseConfig).toThrow('Config not found');
    });
  });
});
