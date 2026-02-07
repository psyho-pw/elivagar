import { createHash } from 'crypto';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
  iss?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class JwtService {
  constructor(@Inject(ConfigsServiceKey) private readonly configsService: IConfigsService) {}

  generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'>): TokenPair {
    const { jwtSecret, jwtRefreshSecret, jwtAlgorithm, jwtExpire, jwtRefreshExpire, jwtIssuer } =
      this.configsService.AppConfig;

    const accessToken = jwt.sign(payload, jwtSecret, {
      algorithm: jwtAlgorithm,
      expiresIn: jwtExpire,
      issuer: jwtIssuer,
    });

    const refreshToken = jwt.sign({ sub: payload.sub }, jwtRefreshSecret, {
      algorithm: jwtAlgorithm,
      expiresIn: jwtRefreshExpire,
      issuer: jwtIssuer,
    });

    return { accessToken, refreshToken, expiresIn: jwtExpire };
  }

  verifyAccessToken(token: string): JwtPayload {
    const { jwtSecret, jwtAlgorithm, jwtIssuer } = this.configsService.AppConfig;
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: [jwtAlgorithm],
      issuer: jwtIssuer,
    });
    return decoded as unknown as JwtPayload;
  }

  verifyRefreshToken(token: string): { sub: string } {
    const { jwtRefreshSecret, jwtAlgorithm, jwtIssuer } = this.configsService.AppConfig;
    const decoded = jwt.verify(token, jwtRefreshSecret, {
      algorithms: [jwtAlgorithm],
      issuer: jwtIssuer,
    });
    return decoded as unknown as { sub: string };
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
