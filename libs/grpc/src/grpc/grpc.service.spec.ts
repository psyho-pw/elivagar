import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { ReflectionService } from '@grpc/reflection';
import { Transport } from '@nestjs/microservices';
import { Mocked, TestBed } from '@suites/unit';
import { GrpcService } from './grpc.service';

jest.mock('@grpc/reflection', () => ({
  ReflectionService: jest.fn().mockImplementation(() => ({
    addToServer: jest.fn(),
  })),
}));

describe('GrpcService', () => {
  let service: GrpcService;
  let configsService: Mocked<IConfigsService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(GrpcService)
      .mock(ConfigsServiceKey)
      .impl(() => ({
        AppConfig: { grpcPort: 5000 },
        DatabaseConfig: {},
      }))
      .compile();
    service = unit;
    configsService = unitRef.get(ConfigsServiceKey);

    jest.clearAllMocks();
  });

  describe('getOptions', () => {
    it('should return gRPC transport options', () => {
      const options = service.getOptions({ name: 'auth' });

      expect(options.transport).toBe(Transport.GRPC);
    });

    it('should construct proto path with name and default version', () => {
      const options = service.getOptions({ name: 'auth' });

      expect(options.options!.protoPath).toContain('proto/auth/v1/auth.proto');
    });

    it('should use custom version in proto path', () => {
      const options = service.getOptions({ name: 'auth', version: 'v2' });

      expect(options.options!.protoPath).toContain('proto/auth/v2/auth.proto');
    });

    it('should convert name to camelCase for package name', () => {
      const options = service.getOptions({ name: 'sayho-bot' });

      expect(options.options!.package).toBe('sayhoBot.v1');
    });

    it('should use simple name without conversion when already camelCase', () => {
      const options = service.getOptions({ name: 'auth' });

      expect(options.options!.package).toBe('auth.v1');
    });

    it('should include version in package name', () => {
      const options = service.getOptions({ name: 'notification', version: 'v2' });

      expect(options.options!.package).toBe('notification.v2');
    });

    it('should set URL with port from config', () => {
      const options = service.getOptions({ name: 'auth' });

      expect(options.options!.url).toBe('0.0.0.0:5000');
    });

    it('should use different port from config', () => {
      (configsService as unknown as { AppConfig: { grpcPort: number } }).AppConfig = {
        grpcPort: 8080,
      };

      const options = service.getOptions({ name: 'auth' });

      expect(options.options!.url).toBe('0.0.0.0:8080');
    });

    it('should enable graceful shutdown', () => {
      const options = service.getOptions({ name: 'auth' });

      expect(options.options!.gracefulShutdown).toBe(true);
    });

    it('should set max message lengths to 10MB', () => {
      const options = service.getOptions({ name: 'auth' });
      const tenMB = 1024 * 1024 * 10;

      expect(options.options!.maxSendMessageLength).toBe(tenMB);
      expect(options.options!.maxReceiveMessageLength).toBe(tenMB);
    });

    it('should configure keepalive settings', () => {
      const options = service.getOptions({ name: 'auth' });
      const keepalive = (options.options as unknown as Record<string, unknown>).keepalive;

      expect(keepalive).toEqual({
        keepaliveTimeMs: 30000,
        keepaliveTimeoutMs: 20000,
        keepalivePermitWithoutCalls: 1,
      });
    });

    it('should set onLoadPackageDefinition callback that registers ReflectionService', () => {
      const options = service.getOptions({ name: 'auth' });
      const callback = options.options!.onLoadPackageDefinition;

      expect(callback).toBeDefined();
      expect(typeof callback).toBe('function');

      const mockServer = {};
      callback!({} as never, mockServer as never);

      expect(ReflectionService).toHaveBeenCalled();
      const mockInstance = (ReflectionService as unknown as jest.Mock).mock.results[0].value;
      expect(mockInstance.addToServer).toHaveBeenCalledWith(mockServer);
    });
  });
});
