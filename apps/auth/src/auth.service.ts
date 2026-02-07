import { LoggerService } from '@app/core/logger/logger.service';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { JwtPayload, JwtService } from './jwt/jwt.service';
import { User } from './user/user.entity';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly loggerService: LoggerService,
  ) {}

  async register(email: string, password: string, name: string): Promise<{ userId: string; email: string }> {
    const existing = await this.em.findOne(User, { email, deletedAt: null });
    if (existing) {
      throw new RpcException({
        code: GrpcStatus.ALREADY_EXISTS,
        message: 'Email already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    // MikroORM handles default values (createdAt, updatedAt, deletedAt) at entity level
    const user = this.em.create(User, {
      email,
      name,
      password: hashedPassword,
      roles: ['user'],
    } as unknown as User);
    await this.em.flush();

    return { userId: user.id, email: user.email };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const user = await this.em.findOne(User, { email, deletedAt: null });
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

  validateToken(token: string): {
    valid: boolean;
    user:
      | { userId: string; email: string; roles: string[]; tokenExp: number; tokenHash: string }
      | undefined;
    errorMessage: string;
  } {
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

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const { sub } = this.jwtService.verifyRefreshToken(refreshToken);
      const user = await this.em.findOne(User, { id: sub, deletedAt: null });

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
