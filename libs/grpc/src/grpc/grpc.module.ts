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
  public static makeOptions({ name, version = 'v1', url }: GrpcModuleOptions): GrpcOptions {
    const protoPath = join(__dirname, `../../../../proto/${name}/${version}/${name}.proto`);

    const opt: GrpcOptions = {
      transport: Transport.GRPC,
      options: {
        package: `${camelCase(name)}.${version}`,
        protoPath,
        gracefulShutdown: true,
        ...(url && { url }),
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

  static register({ name, version = 'v1', url }: GrpcModuleOptions): DynamicModule {
    return {
      module: GrpcModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name,
            useFactory: (_configsService: IConfigsService): GrpcOptions =>
              this.makeOptions({ name, version, url }),
            inject: [ConfigsServiceKey],
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
