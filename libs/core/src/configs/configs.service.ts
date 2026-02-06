import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configs,
  IApp,
  IAuthGrpcConfig,
  IConfigsService,
  IDatabase,
  IDiscordConfig,
  IKafkaConfig,
  IRedisConfig,
  IYoutubeConfig,
} from './configs.interface';
import { AppConfigKey } from './configurations/app.config';
import { AuthGrpcConfigKey } from './configurations/auth-grpc.config';
import { DatabaseConfigKey } from './configurations/database.config';
import { DiscordConfigKey } from './configurations/discord.config';
import { KafkaConfigKey } from './configurations/kafka.config';
import { RedisConfigKey } from './configurations/redis.config';
import { YoutubeConfigKey } from './configurations/youtube.config';

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

  public get DiscordConfig(): IDiscordConfig {
    return this.configService.getOrThrow(DiscordConfigKey, { infer: true });
  }

  public get YoutubeConfig(): IYoutubeConfig {
    return this.configService.getOrThrow(YoutubeConfigKey, { infer: true });
  }

  public get AuthGrpcConfig(): IAuthGrpcConfig {
    return this.configService.getOrThrow(AuthGrpcConfigKey, { infer: true });
  }
}
