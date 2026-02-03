import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configs,
  IApp,
  IConfigsService,
  IDatabase,
  IKafkaConfig,
  IRedisConfig,
} from './configs.interface';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';
import { KafkaConfigKey } from './configurations/kafka.config';
import { RedisConfigKey } from './configurations/redis.config';

@Injectable()
export class ConfigsService implements IConfigsService {
  public constructor(private readonly configService: ConfigService<Configs>) {}

  public get AppConfig(): IApp {
    return this.configService.getOrThrow(AppConfigKey, { infer: true });
  }

  public get DatabaseConfig(): IDatabase {
    return this.configService.getOrThrow(DatabaseConfigKey, { infer: true });
  }

  public get RedisConfig(): IRedisConfig {
    return this.configService.getOrThrow(RedisConfigKey, { infer: true });
  }

  public get KafkaConfig(): IKafkaConfig {
    return this.configService.getOrThrow(KafkaConfigKey, { infer: true });
  }
}
