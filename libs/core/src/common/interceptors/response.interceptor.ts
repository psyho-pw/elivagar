import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../response/api-response';
import { BYPASS_RESPONSE_INTERCEPTOR } from '../response/response.constant';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const doBypass =
      this.reflector.get<boolean>(BYPASS_RESPONSE_INTERCEPTOR, context.getClass()) ||
      this.reflector.get<boolean>(BYPASS_RESPONSE_INTERCEPTOR, context.getHandler());

    return next.handle().pipe(
      map((response) => {
        if (doBypass || response instanceof ApiResponse) return response;

        const res: Response = context.switchToHttp().getResponse();
        return new ApiResponse({ statusCode: res.statusCode ?? HttpStatus.OK, data: response });
      }),
    );
  }
}
