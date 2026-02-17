import { Injectable } from '@nestjs/common';
import { ConnectionState } from './lifecycle.constant';
import { IConnectionEntry, IConnectionMetadata, IManagedConnection } from './lifecycle.interface';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class ConnectionRegistryService {
  private readonly connections = new Map<string, IConnectionEntry>();
  private readonly stateListeners = new Set<(name: string, state: ConnectionState) => void>();

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Register a managed connection
   */
  register(connection: IManagedConnection, metadata: Partial<IConnectionMetadata> = {}): void {
    const name = connection.connectionName;

    if (this.connections.has(name)) {
      this.loggerService.warn(
        this.register.name,
        `Connection '${name}' is already registered, replacing...`,
      );
    }

    const entry: IConnectionEntry = {
      connection,
      metadata: {
        name,
        required: metadata.required ?? true,
      },
      registeredAt: new Date(),
    };

    this.connections.set(name, entry);
    this.loggerService.debug(this.register.name, `Registered connection: ${name}`);
  }

  /**
   * Unregister a connection
   */
  unregister(name: string): boolean {
    const removed = this.connections.delete(name);
    if (removed) {
      this.loggerService.debug(this.unregister.name, `Unregistered connection: ${name}`);
    }
    return removed;
  }

  /**
   * Get a specific connection
   */
  get(name: string): IConnectionEntry | undefined {
    return this.connections.get(name);
  }

  /**
   * Get all registered connections
   */
  getAllConnections(): IConnectionEntry[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get only required connections
   */
  getRequiredConnections(): IConnectionEntry[] {
    return this.getAllConnections().filter((e) => e.metadata.required);
  }

  /**
   * Check if all required connections are ready
   */
  async areAllRequiredReady(): Promise<boolean> {
    const required = this.getRequiredConnections();

    for (const entry of required) {
      if (entry.connection.state !== ConnectionState.CONNECTED) {
        return false;
      }

      try {
        const healthy = await entry.connection.isHealthy();
        if (!healthy) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Get pending (not yet connected) required connections
   */
  getPendingRequiredConnections(): string[] {
    return this.getRequiredConnections()
      .filter((e) => e.connection.state !== ConnectionState.CONNECTED)
      .map((e) => e.metadata.name);
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(listener: (name: string, state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Emit state change event (called by connections)
   */
  emitStateChange(name: string, state: ConnectionState): void {
    for (const listener of this.stateListeners) {
      listener(name, state);
    }
  }

  /**
   * Check if there are any registered connections
   */
  hasConnections(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
