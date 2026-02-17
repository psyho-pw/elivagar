import { AuthModule } from '@app/auth/auth.module';
import { CacheModule } from '@app/cache/cache.module';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { AppName } from '@app/core/constants/app.constant';
import { CoreModule } from '@app/core/core.module';
import { MikroConnectionService } from '@app/core/lifecycle/mikro-connection.service';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { KafkaModule } from '@app/kafka/kafka/kafka.module';
import { MikroOrmContextInterceptor } from '@app/mikro/interceptors/mikro-orm-context.interceptor';
import { MikroOrmModule } from '@app/mikro/mikro.module';
import { MikroOrmModule as OrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigsModule } from './configs/configs.module';
import { ConfigsService } from './configs/configs.service';
import { DiscordModule } from './discord/discord.module';
import { Notification } from './notification/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    ConfigsModule,
    CoreModule,
    MikroOrmModule.getInstance(),
    OrmModule.forFeature([Notification]),
    GrpcModule.register({ name: AppName.Notification }),
    KafkaModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        kafka: configsService.KafkaConfig,
      }),
      inject: [ConfigsServiceKey],
    }),
    CacheModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        redis: configsService.RedisConfig,
        namespace: AppName.Notification,
      }),
      inject: [ConfigsServiceKey],
    }),
    AuthModule.registerAsync({
      useFactory: (configsService: ConfigsService) => ({
        url: configsService.AuthGrpcConfig.url,
      }),
      inject: [ConfigsServiceKey],
    }),
    DiscordModule,
  ],
  controllers: [NotificationController],
  providers: [
    MikroConnectionService,
    { provide: APP_INTERCEPTOR, useClass: MikroOrmContextInterceptor },
    AuthModule.getGuardProvider(),
    AuthModule.getEventListenerProvider(),
    KafkaModule.getExceptionFilterProvider(),
    NotificationService,
  ],
})
export class NotificationModule {}
