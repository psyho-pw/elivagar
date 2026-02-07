import { Public } from '@app/auth/decorators/public.decorator';
import { TransformDto } from '@app/grpc/grpc/grpc.decorator';
import { GrpcDto } from '@app/grpc/grpc/grpc.interface';
import {
  PingRequest,
  PingResponse,
  SayhoBotServiceServiceName,
} from '@app/grpc/proto/generated/sayho-bot/v1/sayho-bot';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { SayhoBotService } from './sayho-bot.service';

export interface ISendKafkaTest {
  body: {
    message: string;
  };
  response: {
    success: boolean;
    message: string;
  };
}

const SendKafkaTestBodySchema = z.object({
  message: z.string(),
});

@Controller('/')
export class SayhoBotController {
  constructor(private readonly sayhoBotService: SayhoBotService) {}

  @Public()
  @Get('/')
  getHello(): string {
    return this.sayhoBotService.getHello();
  }

  @Public()
  @Post('/kafka/test')
  sendKafkaTest(
    @Body(new ZodValidationPipe(SendKafkaTestBodySchema)) body: ISendKafkaTest['body'],
  ): ISendKafkaTest['response'] {
    this.sayhoBotService.sendNotification(body.message);
    return { success: true, message: `Event sent: ${body.message}` };
  }

  @GrpcMethod(SayhoBotServiceServiceName)
  @TransformDto()
  ping({ data, metadata }: GrpcDto<PingRequest, PingResponse>): PingResponse {
    return { message: 'Pong' };
  }
}
