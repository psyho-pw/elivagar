import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { GracePeriodService } from './grace-period.service';
import { GRACE_PERIOD_CONFIG, READINESS_CONFIG } from './lifecycle.constant';
import { IGracePeriodConfig, IReadinessConfig } from './lifecycle.interface';
import { ReadinessGateService } from './readiness-gate.service';

export interface LifecycleModuleOptions {
  gracePeriod?: IGracePeriodConfig;
  readiness?: IReadinessConfig;
}

@Global()
@Module({})
export class LifecycleModule {
  static forRoot(options: LifecycleModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: GRACE_PERIOD_CONFIG,
        useValue: {
          gracePeriod: 5000,
          ...options.gracePeriod,
        } as IGracePeriodConfig,
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
      GracePeriodService,
    ];

    return {
      module: LifecycleModule,
      providers,
      exports: [ConnectionRegistryService, ReadinessGateService, GracePeriodService],
    };
  }
}
