import '@app/core/types/express';
import { IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { v7 } from 'uuid';

@Injectable()
export class RequestIdGuard implements CanActivate {
  constructor(@Inject(ClsServiceKey) private readonly clsService: IClsService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
    const requestId: string = (request.headers['x-request-id'] as string) || v7();

    this.clsService.requestId = requestId;
    request.requestId = requestId;
    request.startTime = Date.now();

    return true;
  }
}
