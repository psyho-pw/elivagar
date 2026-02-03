import { CacheModule } from '@app/cache/cache.module';
import { RequestIdGuard } from '@app/core/common/guards/cls.guard';
import { AppName } from '@app/core/constants/app.constant';
import { CoreModule } from '@app/core/core.module';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { KafkaModule } from '@app/kafka/kafka/kafka.module';
import { Module } from '@nestjs/common';
import { ConfigsModule } from './configs/configs.module';
import { SayhoBotController } from './sayho-bot.controller';
import { SayhoBotService } from './sayho-bot.service';

const guards = [RequestIdGuard];

@Module({
  imports: [
    ConfigsModule,
    CoreModule,
    GrpcModule.register({ name: AppName.SayhoBot, version: 'v1' }),
    KafkaModule.register(),
    CacheModule.register({ namespace: 'sayho-bot' }),
    // SongModule,
  ],
  controllers: [SayhoBotController],
  providers: [...guards, SayhoBotService],
})
export class SayhoBotModule {}
