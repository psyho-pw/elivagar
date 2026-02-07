import { AppName } from '@app/core/constants/app.constant';
import { LoggerService } from '@app/core/logger/logger.service';
import {
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '@app/grpc/proto/generated/auth/v1/auth';
import { faker } from '@faker-js/faker';
import { ClientGrpc } from '@nestjs/microservices';
import { TestBed, Mocked } from '@suites/unit';
import { Observable, of, throwError } from 'rxjs';
import { AuthGrpcClientService } from './auth-grpc-client.service';

describe('AuthGrpcClientService', () => {
  let service: AuthGrpcClientService;
  let client: Mocked<ClientGrpc>;
  let loggerService: Mocked<LoggerService>;
  let mockAuthService: {
    ValidateToken: jest.Mock<Observable<ValidateTokenResponse>, [ValidateTokenRequest]>;
  };

  beforeAll(async () => {
    mockAuthService = {
      ValidateToken: jest.fn(),
    };

    const { unit, unitRef } = await TestBed.solitary(AuthGrpcClientService)
      .mock(AppName.Auth)
      .impl(() => ({
        getService: jest.fn().mockReturnValue(mockAuthService),
        getClientByServiceName: jest.fn(),
      }))
      .compile();

    service = unit;
    client = unitRef.get(AppName.Auth);
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('onModuleInit', () => {
    it('should get AuthService from gRPC client', () => {
      service.onModuleInit();

      expect(client.getService).toHaveBeenCalledWith('AuthService');
    });

    it('should log initialization message', () => {
      service.onModuleInit();

      expect(loggerService.info).toHaveBeenCalledWith(
        'onModuleInit',
        undefined,
        'Auth gRPC client initialized',
      );
    });
  });

  describe('validateToken', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should call ValidateToken with the provided token', async () => {
      const token = faker.string.alphanumeric(32);
      const userId = faker.string.uuid();
      const email = faker.internet.email();
      const role = faker.word.noun();
      const tokenHash = faker.string.hexadecimal({ length: 64, prefix: '' });
      const tokenExp = faker.number.int({ min: 9999999990, max: 9999999999 });

      const response = {
        valid: true,
        user: {
          userId,
          email,
          roles: [role],
          tokenHash,
          tokenExp,
        },
        errorMessage: '',
      };
      mockAuthService.ValidateToken.mockReturnValue(of(response));

      const result = await service.validateToken(token);

      expect(mockAuthService.ValidateToken).toHaveBeenCalledWith({
        token,
      });
      expect(result).toEqual(response);
    });

    it('should propagate errors from gRPC call', async () => {
      const token = faker.string.alphanumeric(32);
      const grpcError = new Error('UNAVAILABLE: Connection refused');
      mockAuthService.ValidateToken.mockReturnValue(throwError(() => grpcError));

      await expect(service.validateToken(token)).rejects.toThrow('UNAVAILABLE: Connection refused');
    });
  });
});
