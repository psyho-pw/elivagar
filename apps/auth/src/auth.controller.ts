import { TransformDto } from '@app/grpc/grpc/grpc.decorator';
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
import { GrpcThrottle } from './guards/grpc-throttle.decorator';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod(AuthServiceServiceName)
  @TransformDto()
  @GrpcThrottle(3, 60)
  async Register({ data }: GrpcDto<RegisterRequest, RegisterResponse>): Promise<RegisterResponse> {
    return this.authService.register(data.email, data.password, data.name);
  }

  @GrpcMethod(AuthServiceServiceName)
  @TransformDto()
  @GrpcThrottle(5, 60)
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
