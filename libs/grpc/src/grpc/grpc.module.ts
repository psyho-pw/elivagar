import { join } from 'path';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, GrpcOptions, Transport } from '@nestjs/microservices';
import { camelCase } from 'change-case';
import { GrpcModuleOptions } from './grpc.interface';
import { GrpcService } from './grpc.service';

@Module({
  providers: [GrpcService],
  exports: [GrpcService],
})
export class GrpcModule {
  private static makeOptions({ name, version = 'v1' }: GrpcModuleOptions): GrpcOptions {
    const protoPath = join(__dirname, `../../../../proto/${name}/${version}/${name}.proto`);

    const opt: GrpcOptions = {
      transport: Transport.GRPC,
      options: {
        package: camelCase(name),
        protoPath,
        gracefulShutdown: true,
        maxSendMessageLength: 1024 * 1024 * 10,
        maxReceiveMessageLength: 1024 * 1024 * 10,
        keepalive: {
          keepaliveTimeMs: 30000,
          keepaliveTimeoutMs: 20000,
          keepalivePermitWithoutCalls: 1,
        },
      },
    };

    return opt;
  }

  static register({ name, version = 'v1' }: GrpcModuleOptions): DynamicModule {
    return {
      module: GrpcModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name,
            useFactory: (_configsService: IConfigsService): GrpcOptions =>
              this.makeOptions({ name, version }),
            inject: [ConfigsServiceKey],
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
