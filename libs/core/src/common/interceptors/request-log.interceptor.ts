import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';

const SLOW_REQUEST_THRESHOLD = 10_000;
const SKIP_PATHS = ['/health-check', '/metrics'];

interface RequestLog {
  method: string;
  url: string;
  headers?: object;
  query?: object;
}

interface ResponseLog {
  status: number;
  responseTime: number;
  headers?: object;
  body?: string;
}

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: LoggerService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req: Request = httpContext.getRequest();
    const { originalUrl } = req;

    if (SKIP_PATHS.some((path) => originalUrl.includes(path))) {
      return next.handle();
    }

    const startTime = Date.now();

    const request: RequestLog = {
      method: req.method,
      url: req.url,
    };

    this.loggerService.info('intercept', request, `REQUEST [${request.method}] ${request.url}`);

    return next.handle().pipe(
      tap((_resBody) => {
        const res: Response = httpContext.getResponse();
        const responseTime = Date.now() - startTime;

        const response: ResponseLog = {
          status: res.statusCode,
          responseTime,
        };

        const logPayload = { request, response };
        const tag = `[${request.method}] ${request.url}`;

        if (responseTime >= SLOW_REQUEST_THRESHOLD) {
          this.loggerService.error(
            'intercept',
            logPayload,
            `SLOW REQUEST ${tag} - ${responseTime}ms`,
          );
        } else {
          this.loggerService.info('intercept', logPayload, `RESPONSE ${tag}`);
        }
      }),
    );
  }
}
