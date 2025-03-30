import { AppName } from '@app/core/constants/app.constant';
import { GrpcModule } from '@app/core/grpc/grpc.module';
import { Module } from '@nestjs/common';
import { CoreModule } from 'libs/core/core.module';
import { ConfigsModule } from './configs/configs.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [ConfigsModule, CoreModule, GrpcModule.register({ name: AppName.Notification })],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
