import { AbstractMain } from '@app/core/bootstrap/abstract-main';
import { BootstrapConfig } from '@app/core/bootstrap/bootstrap.interface';
import { Type } from '@nestjs/common';
import { NotificationModule } from './notification.module';

class NotificationMain extends AbstractMain {
  protected getModule(): Type<unknown> {
    return NotificationModule;
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

NotificationMain.run();
