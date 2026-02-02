import { AbstractMain, BootstrapConfig } from '@app/core/bootstrap';
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
