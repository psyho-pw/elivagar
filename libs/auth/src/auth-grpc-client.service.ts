import { AppName } from '@app/core/constants/app.constant';
import { LoggerService } from '@app/core/logger/logger.service';
import {
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '@app/grpc/proto/generated/auth/v1/auth';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

interface AuthGrpcService {
  ValidateToken(request: ValidateTokenRequest): Observable<ValidateTokenResponse>;
}

@Injectable()
export class AuthGrpcClientService implements OnModuleInit {
  private authService!: AuthGrpcService;

  constructor(
    @Inject(AppName.Auth) private readonly client: ClientGrpc,
    private readonly loggerService: LoggerService,
  ) {}

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcService>('AuthService');
    this.loggerService.info('onModuleInit', undefined, 'Auth gRPC client initialized');
  }

  async validateToken(token: string): Promise<ValidateTokenResponse> {
    return firstValueFrom(this.authService.ValidateToken({ token }));
  }
}
