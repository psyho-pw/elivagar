import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { SHUTDOWN_CONFIG } from './lifecycle.constant';
import { ConnectionState, IConnectionEntry, IShutdownConfig } from './lifecycle.interface';

enum ShutdownPhase {
  DRAIN = 'DRAIN',
  CLOSE_CONNECTIONS = 'CLOSE_CONNECTIONS',
}

@Injectable()
export class ShutdownManagerService implements BeforeApplicationShutdown, OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownManagerService.name);
  private isShuttingDown = false;

  constructor(
    private readonly connectionRegistry: ConnectionRegistryService,
    @Inject(SHUTDOWN_CONFIG)
    private readonly config: IShutdownConfig,
  ) {}

  /**
   * NestJS lifecycle hook - called before shutdown starts
   * Use this for grace period (load balancer deregistration)
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutdown signal received: ${signal ?? 'unknown'}`);

    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    // Grace period for load balancer deregistration
    const gracePeriod = this.config.gracePeriod ?? 5000;
    if (gracePeriod > 0) {
      this.logger.log(`Waiting ${gracePeriod}ms grace period...`);
      await this.sleep(gracePeriod);
    }
  }

  /**
   * NestJS lifecycle hook - called during application shutdown
   * Use this to close connections
   */
  async onApplicationShutdown(_signal?: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Phase 1: Drain pending work
      await this.executePhase(ShutdownPhase.DRAIN);

      // Phase 2: Close connections
      await this.executePhase(ShutdownPhase.CLOSE_CONNECTIONS);

      const duration = Date.now() - startTime;
      this.logger.log(`Graceful shutdown completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  private async executePhase(phase: ShutdownPhase): Promise<void> {
    this.logger.log(`Executing shutdown phase: ${phase}`);

    const connections = this.connectionRegistry.getAllConnections();

    if (connections.length === 0) {
      this.logger.debug('No connections to shutdown');
      return;
    }

    // Sort by shutdown priority (higher priority shuts down first)
    const sorted = [...connections].sort(
      (a, b) => (b.metadata.shutdownPriority ?? 0) - (a.metadata.shutdownPriority ?? 0),
    );

    for (const entry of sorted) {
      await this.executeConnectionPhase(entry, phase);
    }
  }

  private async executeConnectionPhase(
    entry: IConnectionEntry,
    phase: ShutdownPhase,
  ): Promise<void> {
    const { connection, metadata } = entry;
    const timeout = metadata.shutdownTimeout ?? this.config.timeout ?? 30000;

    try {
      switch (phase) {
        case ShutdownPhase.DRAIN:
          if (connection.drain) {
            this.logger.log(`Draining ${metadata.name}...`);
            await this.withTimeout(
              connection.drain(),
              timeout,
              `Drain timeout for ${metadata.name}`,
            );
            this.logger.log(`${metadata.name} drain complete`);
          }
          break;

        case ShutdownPhase.CLOSE_CONNECTIONS:
          if (connection.state !== ConnectionState.DISCONNECTED) {
            this.logger.log(`Disconnecting ${metadata.name}...`);
            await this.withTimeout(
              connection.disconnect(),
              timeout,
              `Disconnect timeout for ${metadata.name}`,
            );
            this.logger.log(`Disconnected from ${metadata.name}`);
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Error during ${phase} for ${metadata.name}:`, error);
      // Continue with other connections even if one fails
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
