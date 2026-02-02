import { AbstractMain, BootstrapConfig } from '@app/core/bootstrap';
import { Type } from '@nestjs/common';
import { SayhoBotModule } from './sayho-bot.module';

class SayhoBotMain extends AbstractMain {
  protected getModule(): Type<unknown> {
    return SayhoBotModule;
  }

  protected getBootstrapConfig(): BootstrapConfig {
    return {
      grpc: { enabled: true },
      middleware: {
        globalPrefix: 'api',
      },
      versioning: { enabled: true },
    };
  }
}

SayhoBotMain.run();
