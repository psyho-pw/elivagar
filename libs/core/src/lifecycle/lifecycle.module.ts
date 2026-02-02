import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { READINESS_CONFIG, SHUTDOWN_CONFIG } from './lifecycle.constant';
import { IReadinessConfig, IShutdownConfig } from './lifecycle.interface';
import { ReadinessGateService } from './readiness-gate.service';
import { ShutdownManagerService } from './shutdown-manager.service';

export interface LifecycleModuleOptions {
  shutdown?: IShutdownConfig;
  readiness?: IReadinessConfig;
}

@Global()
@Module({})
export class LifecycleModule {
  static forRoot(options: LifecycleModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: SHUTDOWN_CONFIG,
        useValue: {
          timeout: 30000,
          gracePeriod: 5000,
          verbose: false,
          ...options.shutdown,
        } as IShutdownConfig,
      },
      {
        provide: READINESS_CONFIG,
        useValue: {
          timeout: 30000,
          checkInterval: 1000,
          ...options.readiness,
        } as IReadinessConfig,
      },
      ConnectionRegistryService,
      ReadinessGateService,
      ShutdownManagerService,
    ];

    return {
      module: LifecycleModule,
      providers,
      exports: [ConnectionRegistryService, ReadinessGateService, ShutdownManagerService],
    };
  }
}
