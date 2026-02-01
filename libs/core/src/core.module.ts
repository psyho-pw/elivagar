import { MikroOrmModule } from '@app/mikro/mikro.module';
import { Global, Module } from '@nestjs/common';
import { ClsModule } from './cls/cls.module';
import { LoggerModule } from './logger/logger.module';

@Global()
@Module({
  imports: [LoggerModule, MikroOrmModule.getInstance(), ClsModule],
  providers: [],
  exports: [],
})
export class CoreModule {}
