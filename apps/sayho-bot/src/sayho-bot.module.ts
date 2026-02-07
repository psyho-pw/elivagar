import { AuthModule } from '@app/auth/auth.module';
import { CacheModule } from '@app/cache/cache.module';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { AppName } from '@app/core/constants/app.constant';
import { CoreModule } from '@app/core/core.module';
import { MikroConnectionService } from '@app/core/lifecycle/mikro-connection.service';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { KafkaModule } from '@app/kafka/kafka/kafka.module';
import { MikroOrmModule } from '@app/mikro/mikro.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigsModule } from './configs/configs.module';
import { DiscordModule } from './discord/discord.module';
import { SayhoBotController } from './sayho-bot.controller';
import { SayhoBotService } from './sayho-bot.service';
import { SongModule } from './song/song.module';

@Module({
  imports: [
    ConfigsModule,
    CoreModule,
    MikroOrmModule.getInstance(),
    ScheduleModule.forRoot(),
    GrpcModule.register({ name: AppName.SayhoBot, version: 'v1' }),
    KafkaModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        kafka: configsService.KafkaConfig!,
      }),
      inject: [ConfigsServiceKey],
    }),
    CacheModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        redis: configsService.RedisConfig!,
        namespace: AppName.SayhoBot,
        db: 0,
      }),
      inject: [ConfigsServiceKey],
    }),
    AuthModule.forRoot(),
    DiscordModule,
    SongModule,
  ],
  controllers: [SayhoBotController],
  providers: [
    MikroConnectionService,
    AuthModule.getGuardProvider(),
    AuthModule.getEventListenerProvider(),
    SayhoBotService,
  ],
})
export class SayhoBotModule {}
