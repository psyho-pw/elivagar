import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { ClsModule } from './cls/cls.module';
import { RequestIdGuard } from './common/guards/cls.guard';
import { ErrorInterceptor } from './common/interceptors/error.interceptor';
import { RequestLogInterceptor } from './common/interceptors/request-log.interceptor';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { LoggerModule } from './logger/logger.module';

@Global()
@Module({
  imports: [
    LoggerModule,
    LifecycleModule.forRoot({
      gracePeriod: {
        gracePeriod: 5000,
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
    { provide: APP_INTERCEPTOR, useClass: ErrorInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
  ],
})
export class CoreModule {}
