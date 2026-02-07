import { AppName } from '@app/core/constants/app.constant';
import { CoreModule } from '@app/core/core.module';
import { MikroConnectionService } from '@app/core/lifecycle/mikro-connection.service';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { MikroOrmModule } from '@app/mikro/mikro.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigsModule } from './configs/configs.module';
import { GrpcThrottleGuard } from './guards/grpc-throttle.guard';
import { JwtService } from './jwt/jwt.service';

@Module({
  imports: [
    ConfigsModule,
    CoreModule,
    MikroOrmModule.getInstance(),
    GrpcModule.register({ name: AppName.Auth }),
  ],
  controllers: [AuthController],
  providers: [
    MikroConnectionService,
    { provide: APP_GUARD, useClass: GrpcThrottleGuard },
    AuthService,
    JwtService,
  ],
})
export class AuthModule {}
