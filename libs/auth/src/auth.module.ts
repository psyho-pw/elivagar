import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { AppName } from '@app/core/constants/app.constant';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, GrpcOptions } from '@nestjs/microservices';
import { AuthEventListener } from './auth-event.listener';
import { AuthGrpcClientService } from './auth-grpc-client.service';
import { AuthGuard } from './auth.guard';

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: AppName.Auth,
            useFactory: (configsService: IConfigsService): GrpcOptions =>
              GrpcModule.makeOptions({
                name: AppName.Auth,
                url: configsService.AuthGrpcConfig.url,
              }),
            inject: [ConfigsServiceKey],
          },
        ]),
      ],
      providers: [AuthGrpcClientService],
      exports: [AuthGrpcClientService, ClientsModule],
      global: true,
    };
  }

  /** Register AuthGuard as global APP_GUARD in the consumer module's providers.
   *  Must be used in a module that imports CacheModule. */
  static getGuardProvider(): Provider {
    return { provide: APP_GUARD, useClass: AuthGuard };
  }

  /** Register AuthEventListener in the consumer module's providers.
   *  Must be used in a module that imports CacheModule and KafkaModule. */
  static getEventListenerProvider(): Provider {
    return AuthEventListener;
  }
}
