import { AppName } from '@app/core/constants/app.constant';
import { CoreModule } from '@app/core/core.module';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigsModule } from './configs/configs.module';
import { JwtService } from './jwt/jwt.service';

@Module({
  imports: [ConfigsModule, CoreModule, GrpcModule.register({ name: AppName.Auth })],
  controllers: [AuthController],
  providers: [AuthService, JwtService],
})
export class AuthModule {}
