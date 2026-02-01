import { GrpcDto } from '@app/grpc/grpc/grpc.interface';
import {
  PingRequest,
  PingResponse,
  SayhoBotServiceServiceName,
} from '@app/grpc/proto/generated/sayho-bot/v1/sayho-bot';
import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SayhoBotService } from './sayho-bot.service';

export function TransformDto() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]): unknown {
      const [data, metadata, call] = args;
      const params = { data, metadata, call };

      // 원본 메서드를 호출하되, this 컨텍스트 및 통합된 파라미터 전달
      return originalMethod.call(this, params);
    };

    return descriptor;
  };
}

@Controller('/')
export class SayhoBotController {
  constructor(private readonly sayhoBotService: SayhoBotService) {}

  @Get('/')
  getHello(): string {
    return this.sayhoBotService.getHello();
  }

  @GrpcMethod(SayhoBotServiceServiceName)
  @TransformDto()
  ping({ data, metadata }: GrpcDto<PingRequest, PingResponse>): PingResponse {
    console.log(data);
    console.log(metadata);

    return { message: 'Pong' };
  }
}
