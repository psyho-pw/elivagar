import { IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { v7 } from 'uuid';

@Injectable()
export class RequestIdGuard implements CanActivate {
  constructor(@Inject(ClsServiceKey) private readonly clsService: IClsService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestId: string = request.headers['x-request-id'] || v7();

    this.clsService.requestId = requestId;
    request.requestId = requestId;

    return true;
  }
}
