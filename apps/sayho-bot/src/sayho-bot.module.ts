import { CacheModule } from '@app/cache/cache.module';
import { RequestIdGuard } from '@app/core/common/guards/cls.guard';
import { ConfigsService } from '@app/core/configs/configs.service';
import { AppName } from '@app/core/constants/app.constant';
import { CoreModule } from '@app/core/core.module';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { KafkaModule } from '@app/kafka/kafka/kafka.module';
import { Module } from '@nestjs/common';
import { ConfigsServiceKey } from 'libs/core/src/configs/configs.constant';
import { ConfigsModule } from './configs/configs.module';
import { SayhoBotController } from './sayho-bot.controller';
import { SayhoBotService } from './sayho-bot.service';

const guards = [RequestIdGuard];

@Module({
  imports: [
    ConfigsModule,
    CoreModule,
    GrpcModule.register({ name: AppName.SayhoBot, version: 'v1' }),
    KafkaModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        kafka: configsService.KafkaConfig,
      }),
      inject: [ConfigsServiceKey],
    }),
    CacheModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        redis: configsService.RedisConfig,
        namespace: AppName.SayhoBot,
        db: 0,
      }),
      inject: [ConfigsServiceKey],
    }),
    // SongModule,
  ],
  controllers: [SayhoBotController],
  providers: [...guards, SayhoBotService],
})
export class SayhoBotModule {}
