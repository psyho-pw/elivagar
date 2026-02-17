import { MikroORM, RequestContext } from '@mikro-orm/core';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class MikroOrmContextInterceptor implements NestInterceptor {
  constructor(private readonly orm: MikroORM) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      RequestContext.create(this.orm.em, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
