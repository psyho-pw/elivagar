import { join } from 'path';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { ReflectionService } from '@grpc/reflection';
import { Inject } from '@nestjs/common';
import { GrpcOptions, Transport } from '@nestjs/microservices';
import { camelCase } from 'change-case';
import { GrpcModuleOptions } from './grpc.interface';

export class GrpcService {
  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: IConfigsService,
    private readonly logger: LoggerService,
  ) {}

  public getOptions({ name, version = 'v1' }: GrpcModuleOptions): GrpcOptions {
    const port = this.configsService.AppConfig.grpcPort;
    const protoPath = join(__dirname, `../../../../proto/${name}/${version}/${name}.proto`);

    const opt: GrpcOptions = {
      transport: Transport.GRPC,
      options: {
        package: camelCase(name),
        protoPath,
        gracefulShutdown: true,
        url: `0.0.0.0:${port}`,
        maxSendMessageLength: 1024 * 1024 * 10,
        maxReceiveMessageLength: 1024 * 1024 * 10,
        keepalive: {
          keepaliveTimeMs: 30000,
          keepaliveTimeoutMs: 20000,
          keepalivePermitWithoutCalls: 1,
        },
        onLoadPackageDefinition: (pkg, server) => {
          new ReflectionService(pkg).addToServer(server);
        },
      },
    };

    return opt;
  }
}
