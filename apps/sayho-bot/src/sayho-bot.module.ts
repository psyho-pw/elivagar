import { Module } from '@nestjs/common';
import { CoreModule } from 'libs/core/core.module';
import { ConfigsModule } from './configs/configs.module';
import { SayhoBotController } from './sayho-bot.controller';
import { SayhoBotService } from './sayho-bot.service';

@Module({
  imports: [ConfigsModule, CoreModule],
  controllers: [SayhoBotController],
  providers: [SayhoBotService],
})
export class SayhoBotModule {}
