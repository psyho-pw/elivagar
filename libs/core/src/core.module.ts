import { Global, Module } from '@nestjs/common';
import { ClsModule } from './cls/cls.module';
import { LoggerModule } from './logger/logger.module';
import { MikroOrmModule } from './mikro/mikro.module';

@Global()
@Module({
  imports: [LoggerModule, MikroOrmModule.getInstance(), ClsModule],
  providers: [],
  exports: [],
})
export class CoreModule {}
