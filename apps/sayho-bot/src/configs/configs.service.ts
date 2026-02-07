import {
  IAuthGrpcConfig,
  IDiscordConfig,
  IKafkaConfig,
  IRedisConfig,
  IYoutubeConfig,
} from '@app/core/configs/configs.interface';
import { ConfigsService as CoreConfigsService } from '@app/core/configs/configs.service';
import { AuthGrpcConfigKey } from '@app/core/configs/configurations/auth-grpc.config';
import { DiscordConfigKey } from '@app/core/configs/configurations/discord.config';
import { KafkaConfigKey } from '@app/core/configs/configurations/kafka.config';
import { RedisConfigKey } from '@app/core/configs/configurations/redis.config';
import { YoutubeConfigKey } from '@app/core/configs/configurations/youtube.config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigsService extends CoreConfigsService {
  public get RedisConfig(): IRedisConfig {
    return this.configService.getOrThrow<IRedisConfig>(RedisConfigKey);
  }

  public get KafkaConfig(): IKafkaConfig {
    return this.configService.getOrThrow<IKafkaConfig>(KafkaConfigKey);
  }

  public get DiscordConfig(): IDiscordConfig {
    return this.configService.getOrThrow<IDiscordConfig>(DiscordConfigKey);
  }

  public get YoutubeConfig(): IYoutubeConfig {
    return this.configService.getOrThrow<IYoutubeConfig>(YoutubeConfigKey);
  }

  public get AuthGrpcConfig(): IAuthGrpcConfig {
    return this.configService.getOrThrow<IAuthGrpcConfig>(AuthGrpcConfigKey);
  }
}
