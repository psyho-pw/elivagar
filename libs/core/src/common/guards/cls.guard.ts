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
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class RequestIdGuard implements CanActivate {
  constructor(
    @Inject(ClsServiceKey) private readonly clsService: IClsService,
    private readonly loggerService: LoggerService,
  ) {}

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
    } catch (err: unknown) {
      this.loggerService.error(this.canActivate.name, err as Error);
      return true;
    }
  }
}
