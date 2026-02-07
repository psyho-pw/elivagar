import { BeforeApplicationShutdown, Inject, Injectable } from '@nestjs/common';
import { GRACE_PERIOD_CONFIG } from './lifecycle.constant';
import { IGracePeriodConfig } from './lifecycle.interface';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class GracePeriodService implements BeforeApplicationShutdown {
  constructor(
    @Inject(GRACE_PERIOD_CONFIG)
    private readonly config: IGracePeriodConfig,
    private readonly loggerService: LoggerService,
  ) {}

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.loggerService.info(
      this.beforeApplicationShutdown.name,
      `Shutdown signal received: ${signal ?? 'unknown'}`,
    );

    const gracePeriod = this.config.gracePeriod ?? 5000;
    if (gracePeriod > 0) {
      this.loggerService.info(
        this.beforeApplicationShutdown.name,
        `Waiting ${gracePeriod}ms grace period for load balancer deregistration...`,
      );
      await new Promise((resolve) => setTimeout(resolve, gracePeriod));
    }
  }
}
