import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from './redis.config';
import { RedisClientKey, RedisConfigKey, RedisServiceKey } from './redis.constant';
import { IRedisConfig, RedisModuleOptions } from './redis.interface';
import { RedisService } from './redis.service';

@Module({})
export class RedisModule {
  /**
   * Register Redis module
   * Use this in AppModule imports for services that need Redis
   */
  static register(options: RedisModuleOptions = {}): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule.forFeature(RedisConfig)],
      providers: [
        {
          provide: RedisClientKey,
          useFactory: (configService: ConfigService): Redis => {
            const redisConfig = configService.get<IRedisConfig>(RedisConfigKey)!;

            return new Redis({
              host: redisConfig.host,
              port: redisConfig.port,
              password: redisConfig.password || undefined,
              db: options.db ?? redisConfig.db ?? 0,
              keyPrefix: options.keyPrefix ?? redisConfig.keyPrefix,
              lazyConnect: false,
              retryStrategy: (times: number): number => {
                // Exponential backoff with max 30 seconds
                return Math.min(times * 1000, 30000);
              },
              ...options.options,
            });
          },
          inject: [ConfigService],
        },
        {
          provide: RedisServiceKey,
          useClass: RedisService,
        },
      ],
      exports: [RedisServiceKey, RedisClientKey],
    };
  }
}
