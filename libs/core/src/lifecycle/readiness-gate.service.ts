import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { READINESS_CONFIG } from './lifecycle.constant';
import { IReadinessConfig } from './lifecycle.interface';

@Injectable()
export class ReadinessGateService {
  private readonly logger = new Logger(ReadinessGateService.name);
  private isReady = false;

  constructor(
    private readonly connectionRegistry: ConnectionRegistryService,
    @Inject(READINESS_CONFIG)
    private readonly config: IReadinessConfig,
  ) {}

  /**
   * Wait for all required connections to be ready
   * Called by AbstractMain before starting HTTP server
   * @param timeoutOverride Optional timeout override (ms), uses module config if not provided
   */
  async waitForReady(timeoutOverride?: number): Promise<void> {
    // If no connections registered, immediately ready
    if (!this.connectionRegistry.hasConnections()) {
      this.logger.debug('No connections registered, skipping readiness check');
      this.isReady = true;
      return;
    }

    const timeout = timeoutOverride ?? this.config.timeout ?? 30000;
    const checkInterval = this.config.checkInterval ?? 1000;
    const startTime = Date.now();

    this.logger.log('Waiting for all connections to be ready...');

    while (Date.now() - startTime < timeout) {
      const allReady = await this.connectionRegistry.areAllRequiredReady();

      if (allReady) {
        this.isReady = true;
        this.logger.log('All required connections are ready');
        return;
      }

      // Log pending connections
      const pending = this.connectionRegistry.getPendingRequiredConnections();

      if (pending.length > 0) {
        this.logger.debug(`Waiting for connections: ${pending.join(', ')}`);
      }

      await this.sleep(checkInterval);
    }

    // Timeout reached
    const stillPending = this.connectionRegistry.getPendingRequiredConnections();

    const error = new Error(
      `Readiness timeout after ${timeout}ms. Pending connections: ${stillPending.join(', ')}`,
    );

    this.logger.error(error.message);
    throw error;
  }

  /**
   * Check if the service is ready to accept requests
   */
  getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Mark as ready (for manual control if needed)
   */
  setReady(ready: boolean): void {
    this.isReady = ready;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
