import { LoggerService } from '@app/core/logger/logger.service';
import { KafkaTopics } from '@app/kafka/events/events.constant';
import { AuthUserCreatedEvent } from '@app/kafka/events/events.interface';
import { IKafkaService } from '@app/kafka/kafka/kafka.interface';
import { KafkaServiceKey } from '@app/kafka/kafka/kafka.constant';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Transactional } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import {
  LoginResult,
  RefreshTokenResult,
  RegisterResult,
  ValidateTokenResult,
} from './auth.interface';
import { JwtPayload, JwtService } from './jwt/jwt.service';
import { User } from './user/user.entity';
import { UserRepository } from './user/user.repository';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly loggerService: LoggerService,
    @Inject(KafkaServiceKey) private readonly kafkaService: IKafkaService,
  ) {}

  @Transactional()
  async register(email: string, password: string, name: string): Promise<RegisterResult> {
    const existing = await this.userRepository.findOne({ email, deletedAt: null });
    if (existing) {
      throw new RpcException({
        code: GrpcStatus.ALREADY_EXISTS,
        message: 'Email already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    // MikroORM handles default values (createdAt, updatedAt, deletedAt) at entity level
    const user = this.userRepository.create({
      email,
      name,
      password: hashedPassword,
      roles: ['user'],
    } as unknown as User);

    // TODO: @Transactional() 커밋 전에 emit하므로 롤백 시 이벤트 철회 불가 — Saga/Outbox 패턴 적용 필요
    this.kafkaService.emit(KafkaTopics.Auth.UserCreated, {
      userId: user.id,
      email: user.email,
      name: user.name,
    } satisfies AuthUserCreatedEvent);

    return { userId: user.id, email: user.email };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findOne({ email, deletedAt: null });
    if (!user) {
      throw new RpcException({ code: GrpcStatus.UNAUTHENTICATED, message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new RpcException({ code: GrpcStatus.UNAUTHENTICATED, message: 'Invalid credentials' });
    }

    const tokenPair = this.jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  validateToken(token: string): ValidateTokenResult {
    try {
      const payload: JwtPayload = this.jwtService.verifyAccessToken(token);
      const tokenHash = JwtService.hashToken(token);

      return {
        valid: true,
        user: {
          userId: payload.sub,
          email: payload.email,
          roles: payload.roles,
          tokenExp: payload.exp ?? 0,
          tokenHash,
        },
        errorMessage: '',
      };
    } catch (err) {
      this.loggerService.warn('validateToken', err, 'Token validation failed');
      return {
        valid: false,
        user: undefined,
        errorMessage: err instanceof Error ? err.message : 'Invalid token',
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResult> {
    try {
      const { sub } = this.jwtService.verifyRefreshToken(refreshToken);
      const user = await this.userRepository.findOne({ id: sub, deletedAt: null });

      if (!user) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: 'User not found' });
      }

      const tokenPair = this.jwtService.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles: user.roles,
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
      };
    } catch (err) {
      if (err instanceof RpcException) throw err;
      throw new RpcException({
        code: GrpcStatus.UNAUTHENTICATED,
        message: 'Invalid refresh token',
      });
    }
  }
}
