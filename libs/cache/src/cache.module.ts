import KeyvRedis from '@keyv/redis';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AopModule } from '@toss/nestjs-aop';
import { Keyv } from 'keyv';
import { CacheAspect } from './cache.aspect';
import { CacheConfig } from './cache.config';
import { CacheConfigKey, CacheServiceKey, KeyvRedisKey } from './cache.constant';
import { CacheModuleOptions, ICacheConfig } from './cache.interface';
import { CacheService } from './cache.service';

@Module({})
export class CacheModule {
  /**
   * Register Cache module with lifecycle management
   *
   * @param options.db - Database number (default: 0)
   * @param options.providerToken - Custom provider token for multi-instance scenarios
   * @param options.namespace - Key prefix namespace
   * @param options.ttl - Default TTL in milliseconds
   */
  static register(options: CacheModuleOptions = {}): DynamicModule {
    const serviceToken = options.providerToken ?? CacheServiceKey;

    console.log('[CacheModule] register() called with options:', options);

    const keyvRedisProvider: Provider = {
      provide: KeyvRedisKey,
      useFactory: (configService: ConfigService): KeyvRedis<string> => {
        console.log('[CacheModule] Creating KeyvRedis instance...');
        const cacheConfig = configService.get<ICacheConfig>(CacheConfigKey)!;
        const db = options.db ?? cacheConfig.db ?? 0;

        const redisUrl = cacheConfig.password
          ? `redis://:${cacheConfig.password}@${cacheConfig.host}:${cacheConfig.port}/${db}`
          : `redis://${cacheConfig.host}:${cacheConfig.port}/${db}`;

        console.log('[CacheModule] Redis URL:', redisUrl);
        const keyvRedis = new KeyvRedis<string>(redisUrl, {
          useUnlink: true,
        });
        console.log('[CacheModule] KeyvRedis instance created');
        return keyvRedis;
      },
      inject: [ConfigService],
    };

    const cacheServiceProvider: Provider = {
      provide: serviceToken,
      useClass: CacheService,
    };

    return {
      module: CacheModule,
      imports: [
        ConfigModule.forFeature(CacheConfig),
        AopModule,
        NestCacheModule.registerAsync({
          imports: [ConfigModule.forFeature(CacheConfig)],
          extraProviders: [keyvRedisProvider],
          useFactory: (configService: ConfigService, keyvRedis: KeyvRedis<string>) => {
            console.log('[CacheModule] NestCacheModule useFactory called');
            const cacheConfig = configService.get<ICacheConfig>(CacheConfigKey)!;
            console.log('[CacheModule] CacheConfig:', cacheConfig);
            const namespace = options.namespace ?? cacheConfig.keyPrefix;
            const ttl = options.ttl ?? 60000; // default 1 minute

            console.log('[CacheModule] Creating Keyv with namespace:', namespace, 'ttl:', ttl);
            const keyv = new Keyv({ store: keyvRedis, namespace, ttl });
            console.log('[CacheModule] Keyv instance created');

            return {
              stores: [keyv],
            };
          },
          inject: [ConfigService, KeyvRedisKey],
        }),
      ],
      providers: [keyvRedisProvider, cacheServiceProvider, CacheAspect],
      exports: [serviceToken, KeyvRedisKey, NestCacheModule],
    };
  }
}
