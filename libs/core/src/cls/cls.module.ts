import { ClassProvider, Global, Module } from '@nestjs/common';
import { ClsModule as ClsModuleInNest } from 'nestjs-cls';
import { ClsService } from './cls.service';

export const ClsServiceKey = Symbol('ClsServiceKey');

const clsService: ClassProvider = {
  provide: ClsServiceKey,
  useClass: ClsService,
};

@Global()
@Module({
  imports: [ClsModuleInNest.forRoot({})],
  providers: [clsService],
  exports: [ClsModuleInNest, clsService],
})
export class ClsModule {}
