import { AbstractMain, BootstrapConfig } from '@app/core/bootstrap';
import { Type } from '@nestjs/common';
import { AuthModule } from './auth.module';

class AuthMain extends AbstractMain {
  protected getModule(): Type<unknown> {
    return AuthModule;
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

AuthMain.run();
