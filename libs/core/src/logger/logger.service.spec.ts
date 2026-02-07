jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-log-id'),
}));

import { INQUIRER } from '@nestjs/core';
import { TestBed, Mocked } from '@suites/unit';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { LoggerService } from './logger.service';
import { ClsServiceKey } from '../cls/cls.module';
import { ClsService } from '../cls/cls.service';
import { ConfigsServiceKey } from '../configs/configs.constant';
import { IConfigsService, IApp } from '../configs/configs.interface';
import { Env } from '../constants/app.constant';

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let clsService: Mocked<ClsService>;
  let winstonLogger: Mocked<WinstonLogger>;
  let configsService: Mocked<IConfigsService>;

  const defaultAppConfig: IApp = {
    env: Env.local,
    port: 4000,
    grpcPort: 5000,
    serviceName: 'test-service',
    jwtSecret: 'secret',
    jwtRefreshSecret: 'refresh',
    jwtAlgorithm: 'HS256',
    jwtExpire: 3600,
    jwtRefreshExpire: 86400,
    jwtIssuer: 'test',
    clientURI: 'http://localhost',
  } as IApp;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(LoggerService)
      .mock(INQUIRER)
      .impl(() => ({ constructor: { name: 'TestClass' } }))
      .mock(ConfigsServiceKey)
      .impl(() => ({
        AppConfig: defaultAppConfig,
      }))
      .compile();

    loggerService = unit;
    clsService = unitRef.get(ClsServiceKey);
    winstonLogger = unitRef.get(WINSTON_MODULE_NEST_PROVIDER);
    configsService = unitRef.get(ConfigsServiceKey);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (clsService as unknown as { requestId: string }).requestId = 'cls-request-id';
  });

  describe('context', () => {
    it('should use caller constructor name as context', () => {
      loggerService.info('method', 'test');

      expect(winstonLogger.log).toHaveBeenCalledWith(expect.any(Object), 'TestClass.method');
    });

    it('should default to Unknown when caller has no constructor name', () => {
      const service = new LoggerService(
        clsService as unknown as ClsService,
        winstonLogger as unknown as WinstonLogger,
        null as unknown as object,
        configsService as unknown as IConfigsService,
      );

      service.info('method', 'test');

      expect(winstonLogger.log).toHaveBeenCalledWith(expect.any(Object), 'Unknown.method');
    });

    it('should allow overriding context with setContext', () => {
      loggerService.setContext('CustomContext');
      loggerService.info('action', 'data');

      expect(winstonLogger.log).toHaveBeenCalledWith(expect.any(Object), 'CustomContext.action');

      // Reset context for other tests
      loggerService.setContext('TestClass');
    });
  });

  describe('format', () => {
    it('should include requestId from CLS in log', () => {
      loggerService.info('test', { some: 'data' });

      expect(winstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'cls-request-id' }),
        expect.any(String),
      );
    });

    it('should use provided requestId over CLS requestId', () => {
      loggerService.info('test', { some: 'data' }, 'msg', 'custom-req-id');

      expect(winstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'custom-req-id' }),
        expect.any(String),
      );
    });

    it('should include stack trace for Error objects', () => {
      const error = new Error('test error');
      loggerService.info('test', error);

      expect(winstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ stack: expect.stringContaining('test error') }),
        expect.any(String),
      );
    });

    it('should concatenate string object with message', () => {
      loggerService.info('test', 'prefix', 'suffix');

      expect(winstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'prefix suffix' }),
        expect.any(String),
      );
    });

    it('should set data field for plain objects', () => {
      const data = { key: 'value' };
      loggerService.info('test', data, 'msg');

      expect(winstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ data, message: 'msg' }),
        expect.any(String),
      );
    });

    it('should include logId as UUID', () => {
      loggerService.info('test', {});

      const log = (winstonLogger.log as jest.Mock).mock.calls[0][0];
      expect(log).toHaveProperty('logId');
      expect(typeof log.logId).toBe('string');
    });

    it('should NOT include app/env in development mode', () => {
      loggerService.info('test', {});

      const log = (winstonLogger.log as jest.Mock).mock.calls[0][0];
      expect(log.app).toBeUndefined();
      expect(log.env).toBeUndefined();
    });

    it('should include app/env in production mode', () => {
      const prodConfig = { ...defaultAppConfig, env: Env.production as Env };
      const prodConfigsService = {
        get AppConfig() {
          return prodConfig;
        },
      } as unknown as IConfigsService;

      const caller = { constructor: { name: 'TestClass' } };
      const prodLogger = new LoggerService(
        clsService as unknown as ClsService,
        winstonLogger as unknown as WinstonLogger,
        caller,
        prodConfigsService,
      );

      prodLogger.info('test', {});

      const log = (winstonLogger.log as jest.Mock).mock.calls[0][0];
      expect(log.app).toBe('test-service');
      expect(log.env).toBe(Env.production);
    });

    it('should handle null object gracefully', () => {
      loggerService.info('test', null);

      const log = (winstonLogger.log as jest.Mock).mock.calls[0][0];
      expect(log.data).toBeUndefined();
    });
  });

  describe('log levels', () => {
    it('should call winstonLogger.verbose for verbose()', () => {
      loggerService.verbose('ctx', 'data');
      expect(winstonLogger.verbose).toHaveBeenCalled();
    });

    it('should call winstonLogger.debug for debug()', () => {
      loggerService.debug('ctx', 'data');
      expect(winstonLogger.debug).toHaveBeenCalled();
    });

    it('should call winstonLogger.log for info()', () => {
      loggerService.info('ctx', 'data');
      expect(winstonLogger.log).toHaveBeenCalled();
    });

    it('should call winstonLogger.warn for warn()', () => {
      loggerService.warn('ctx', 'data');
      expect(winstonLogger.warn).toHaveBeenCalled();
    });

    it('should call winstonLogger.error for error() with undefined as trace', () => {
      loggerService.error('ctx', 'data');
      expect(winstonLogger.error).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        'TestClass.ctx',
      );
    });
  });
});
