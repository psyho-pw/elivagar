import { CacheServiceKey } from '@app/cache/cache.constant';
import { ICacheService } from '@app/cache/cache.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { KafkaTopics } from '@app/kafka/events/events.constant';
import { AuthSessionRevokedEvent } from '@app/kafka/events/events.interface';
import { Inject, Injectable } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AUTH_TOKEN_CACHE_PREFIX } from './auth.constant';

@Injectable()
export class AuthEventListener {
  constructor(
    @Inject(CacheServiceKey) private readonly cacheService: ICacheService,
    private readonly loggerService: LoggerService,
  ) {}

  @EventPattern(KafkaTopics.Auth.SessionRevoked)
  async handleSessionRevoked(@Payload() payload: AuthSessionRevokedEvent): Promise<void> {
    this.loggerService.info(
      'handleSessionRevoked',
      { userId: payload.userId },
      `Session revoked, hash: ${payload.tokenHash}`,
    );

    const cacheKey = `${AUTH_TOKEN_CACHE_PREFIX}:${payload.tokenHash}`;
    await this.cacheService.del(cacheKey);
  }
}
