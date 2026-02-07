import { AppName } from '@app/core/constants/app.constant';
import { GrpcModule } from '@app/grpc/grpc/grpc.module';
import { DynamicModule, Module, ModuleMetadata, Provider, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, GrpcOptions } from '@nestjs/microservices';
import { AuthEventListener } from './auth-event.listener';
import { AuthGrpcClientService } from './auth-grpc-client.service';
import { AuthGuard } from './auth.guard';

export interface AuthModuleOptions {
  url: string;
}

export interface AuthModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => AuthModuleOptions | Promise<AuthModuleOptions>;
  inject?: (Type | string | symbol)[];
}

@Module({})
export class AuthModule {
  static registerAsync(asyncOptions: AuthModuleAsyncOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        ...(asyncOptions.imports ?? []),
        ClientsModule.registerAsync([
          {
            name: AppName.Auth,
            useFactory: async (...args: unknown[]): Promise<GrpcOptions> => {
              const options = await asyncOptions.useFactory(...args);
              return GrpcModule.makeOptions({
                name: AppName.Auth,
                url: options.url,
              });
            },
            inject: asyncOptions.inject ?? [],
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
