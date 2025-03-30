import { AppName } from '@app/core/constants/app.constant';
import { GrpcModule } from '@app/core/grpc/grpc.module';
import { Module } from '@nestjs/common';
import { CoreModule } from 'libs/core/core.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigsModule } from './configs/configs.module';

@Module({
  imports: [ConfigsModule, CoreModule, GrpcModule.register({ name: AppName.Auth })],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
