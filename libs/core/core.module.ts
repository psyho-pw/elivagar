import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Global, Module } from '@nestjs/common';
import { ClsModule } from './src/cls/cls.module';
import { LoggerModule } from './src/logger/logger.module';

@Global()
@Module({
  imports: [LoggerModule, MikroOrmModule, ClsModule],
  providers: [],
  exports: [],
})
export class CoreModule {}
