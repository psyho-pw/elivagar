import '@app/core/types/express';
import { IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { Request } from 'express';
import { v7 } from 'uuid';

@Injectable()
export class RequestIdGuard implements CanActivate {
  constructor(@Inject(ClsServiceKey) private readonly clsService: IClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const type = context.getType();
    const requestId = this.extractRequestId(context, type);

    this.clsService.requestId = requestId;
    this.clsService.controllerCtx = context.getClass().name;
    this.clsService.methodCtx = context.getHandler().name;

    if (type === 'http') {
      const request: Request = context.switchToHttp().getRequest();
      request.requestId = requestId;
      request.startTime = Date.now();
    }

    return true;
  }

  private extractRequestId(context: ExecutionContext, type: string): string {
    if (type === 'http') {
      const request: Request = context.switchToHttp().getRequest();
      return (request.headers['x-request-id'] as string) || v7();
    }

    if (type === 'rpc') {
      return this.extractRpcRequestId(context) || v7();
    }

    return v7();
  }

  private extractRpcRequestId(context: ExecutionContext): string | undefined {
    const rpcContext = context.switchToRpc().getContext();

    // Kafka: KafkaContext has getTopic()
    if (typeof rpcContext?.getTopic === 'function') {
      const message = rpcContext.getMessage?.();
      const header = message?.headers?.['x-request-id'];
      if (header) {
        return Buffer.isBuffer(header) ? header.toString() : String(header);
      }
      return undefined;
    }

    // gRPC: instanceof check for reliable detection
    if (rpcContext instanceof Metadata) {
      const values = rpcContext.get('x-request-id');
      if (Array.isArray(values) && values.length > 0) {
        return String(values[0]);
      }
      return undefined;
    }

    return undefined;
  }
}
