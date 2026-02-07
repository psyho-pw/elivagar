import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err) => {
        const callClass = context.getClass().name;
        const callMethod = context.getHandler().name;
        const contextTag = `${callClass}.${callMethod}`;

        if (err instanceof HttpException) {
          if (err.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR) {
            this.loggerService.error('intercept', err, contextTag);
          }

          if (context.getType() === 'http') {
            const payload = err.getResponse();
            context.switchToHttp().getResponse().status(err.getStatus());

            return of(typeof payload === 'string' ? { message: payload } : payload);
          }

          throw err;
        }

        this.loggerService.error('intercept', err, `Unhandled error in ${contextTag}`);

        if (context.getType() === 'http') {
          const status =
            typeof err.getStatus === 'function'
              ? err.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
          context.switchToHttp().getResponse().status(status);

          return of({ message: 'Internal server error' });
        }

        throw err;
      }),
    );
  }
}
