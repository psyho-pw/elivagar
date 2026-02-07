import {
  IAuthGrpcConfig,
  IDiscordWebhookConfig,
  IKafkaConfig,
  IRedisConfig,
} from '@app/core/configs/configs.interface';
import { ConfigsService as CoreConfigsService } from '@app/core/configs/configs.service';
import { AuthGrpcConfigKey } from '@app/core/configs/configurations/auth-grpc.config';
import { DiscordWebhookConfigKey } from '@app/core/configs/configurations/discord-webhook.config';
import { KafkaConfigKey } from '@app/core/configs/configurations/kafka.config';
import { RedisConfigKey } from '@app/core/configs/configurations/redis.config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigsService extends CoreConfigsService {
  public get RedisConfig(): IRedisConfig {
    return this.configService.getOrThrow<IRedisConfig>(RedisConfigKey);
  }

  public get KafkaConfig(): IKafkaConfig {
    return this.configService.getOrThrow<IKafkaConfig>(KafkaConfigKey);
  }

  public get DiscordWebhookConfig(): IDiscordWebhookConfig {
    return this.configService.getOrThrow<IDiscordWebhookConfig>(DiscordWebhookConfigKey);
  }

  public get AuthGrpcConfig(): IAuthGrpcConfig {
    return this.configService.getOrThrow<IAuthGrpcConfig>(AuthGrpcConfigKey);
  }
}
