import { MikroOrmModule } from '@app/mikro/mikro.module';
import { Global, Module } from '@nestjs/common';
import { AopModule } from '@toss/nestjs-aop';
import { ClsModule } from './cls/cls.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { MikroConnectionService } from './lifecycle/mikro-connection.service';
import { LoggerModule } from './logger/logger.module';

@Global()
@Module({
  imports: [
    LoggerModule,
    LifecycleModule.forRoot({
      shutdown: {
        timeout: 30000,
        gracePeriod: 5000,
      },
      readiness: {
        timeout: 30000,
        checkInterval: 1000,
      },
    }),
    MikroOrmModule.getInstance(),
    ClsModule,
    AopModule,
  ],
  providers: [MikroConnectionService],
  exports: [MikroConnectionService],
})
export class CoreModule {}
