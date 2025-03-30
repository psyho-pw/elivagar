import { IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v7 } from 'uuid';

@Injectable()
export class RequestIdGuard implements CanActivate {
  constructor(@Inject(ClsServiceKey) private readonly clsService: IClsService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      if (context.getType() === 'http') {
        const request = context.switchToHttp().getRequest();
        const requestId: string = request.headers['x-request-id'] || v7();

        this.clsService.requestId = requestId;
        request.requestId = requestId;

        return true;
      }

      throw new ServiceUnavailableException('not supported');
    } catch (err) {
      return true;
    }
  }
}
