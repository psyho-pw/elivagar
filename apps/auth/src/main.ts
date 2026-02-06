import { AbstractMain } from '@app/core/bootstrap/abstract-main';
import { BootstrapConfig } from '@app/core/bootstrap/bootstrap.interface';
import { Type } from '@nestjs/common';
import { AuthModule } from './auth.module';

class AuthMain extends AbstractMain {
  protected getModule(): Type<unknown> {
    return AuthModule;
  }

  protected getBootstrapConfig(): BootstrapConfig {
    return {
      options: { bufferLogs: true, enableShutdownHooks: true },
      grpc: { enabled: true },
      middleware: { globalPrefix: 'api' },
      versioning: { enabled: true },
    };
  }
}

AuthMain.run();
