import { ClassSerializerInterceptor, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { ClsModule } from './cls/cls.module';
import { GeneralExceptionFilter } from './common/filters/general-exception.filter';
import { RequestIdGuard } from './common/guards/cls.guard';
import { RequestLogInterceptor } from './common/interceptors/request-log.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { Env } from './constants/app.constant';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { LoggerModule } from './logger/logger.module';

@Global()
@Module({
  imports: [
    LoggerModule,
    LifecycleModule.forRoot({
      gracePeriod: {
        gracePeriod: process.env.NODE_ENV !== Env.production ? 0 : 5000,
      },
      readiness: {
        timeout: 30000,
        checkInterval: 1000,
      },
    }),
    ClsModule,
    AopModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RequestIdGuard },
    { provide: APP_FILTER, useClass: GeneralExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class CoreModule {}
