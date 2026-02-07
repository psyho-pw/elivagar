import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { AppConfig } from '@app/core/configs/configurations/app.config';
import { AuthGrpcConfig } from '@app/core/configs/configurations/auth-grpc.config';
import { DatabaseConfig } from '@app/core/configs/configurations/database.config';
import { DiscordConfig } from '@app/core/configs/configurations/discord.config';
import { KafkaConfig } from '@app/core/configs/configurations/kafka.config';
import { RedisConfig } from '@app/core/configs/configurations/redis.config';
import { YoutubeConfig } from '@app/core/configs/configurations/youtube.config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigsService } from './configs.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      load: [
        AppConfig,
        DatabaseConfig,
        RedisConfig,
        KafkaConfig,
        DiscordConfig,
        YoutubeConfig,
        AuthGrpcConfig,
      ],
    }),
  ],
  providers: [{ provide: ConfigsServiceKey, useClass: ConfigsService }],
  exports: [ConfigsServiceKey],
})
export class ConfigsModule {
  get configsService(): unknown {
    return Reflect.getMetadata('providers', this);
  }
}
