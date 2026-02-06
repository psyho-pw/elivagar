import { createHash } from 'crypto';
import { CacheServiceKey } from '@app/cache/cache.constant';
import { ICacheService } from '@app/cache/cache.interface';
import { AuthUser, IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import { LoggerService } from '@app/core/logger/logger.service';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGrpcClientService } from './auth-grpc-client.service';
import { IS_PUBLIC_KEY, AUTH_TOKEN_CACHE_PREFIX, AUTH_TOKEN_MAX_CACHE_TTL } from './auth.constant';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authGrpcClient: AuthGrpcClientService,
    @Inject(CacheServiceKey) private readonly cacheService: ICacheService,
    @Inject(ClsServiceKey) private readonly clsService: IClsService,
    private readonly loggerService: LoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const cacheKey = `${AUTH_TOKEN_CACHE_PREFIX}:${tokenHash}`;

    const cachedUser = await this.cacheService.get<AuthUser>(cacheKey);
    if (cachedUser) {
      this.setUserContext(request, cachedUser);
      return true;
    }

    try {
      const user = await this.cacheService.wrap<AuthUser | null>(
        cacheKey,
        async () => {
          const response = await this.authGrpcClient.validateToken(token);

          if (!response.valid || !response.user) {
            return null;
          }

          return {
            userId: response.user.userId,
            email: response.user.email,
            roles: response.user.roles,
            tokenHash: response.user.tokenHash,
            tokenExp: response.user.tokenExp,
          };
        },
        AUTH_TOKEN_MAX_CACHE_TTL,
      );

      if (!user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      this.setUserContext(request, user);
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.loggerService.error('canActivate', err as Error, 'Auth gRPC call failed');
      throw new UnauthorizedException('Authentication service unavailable');
    }
  }

  private extractToken(request: { headers: Record<string, string> }): string | null {
    const authorization = request.headers['authorization'];
    if (!authorization) return null;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' && token ? token : null;
  }

  private setUserContext(request: Record<string, unknown>, user: AuthUser): void {
    request.user = user;
    this.clsService.user = user;
  }
}
