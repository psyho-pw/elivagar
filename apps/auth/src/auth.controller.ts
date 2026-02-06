import { GrpcDto } from '@app/grpc/grpc/grpc.interface';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  AuthServiceServiceName,
} from '@app/grpc/proto/generated/auth/v1/auth';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';

function TransformDto() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]): unknown {
      const [data, metadata, call] = args;
      const params = { data, metadata, call };
      return originalMethod.call(this, params);
    };

    return descriptor;
  };
}

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod(AuthServiceServiceName)
  @TransformDto()
  async Register({ data }: GrpcDto<RegisterRequest, RegisterResponse>): Promise<RegisterResponse> {
    return this.authService.register(data.email, data.password);
  }

  @GrpcMethod(AuthServiceServiceName)
  @TransformDto()
  async Login({ data }: GrpcDto<LoginRequest, LoginResponse>): Promise<LoginResponse> {
    return this.authService.login(data.email, data.password);
  }

  @GrpcMethod(AuthServiceServiceName)
  @TransformDto()
  ValidateToken({
    data,
  }: GrpcDto<ValidateTokenRequest, ValidateTokenResponse>): ValidateTokenResponse {
    return this.authService.validateToken(data.token);
  }

  @GrpcMethod(AuthServiceServiceName)
  @TransformDto()
  async RefreshToken({
    data,
  }: GrpcDto<RefreshTokenRequest, RefreshTokenResponse>): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(data.refreshToken);
  }
}
