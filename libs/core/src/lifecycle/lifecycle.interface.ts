/**
 * Connection states for external services
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error',
}

/**
 * Connection metadata for registration
 */
export interface IConnectionMetadata {
  /** Unique name for this connection (e.g., 'kafka', 'database', 'redis') */
  name: string;
  /** Priority for shutdown order (higher = shutdown first, lower = shutdown later) */
  shutdownPriority?: number;
  /** Whether this connection is required for readiness (default: true) */
  required?: boolean;
  /** Custom timeout for this connection's shutdown (ms) */
  shutdownTimeout?: number;
}

/**
 * Interface that external connection services must implement
 */
export interface IManagedConnection {
  /** Unique connection name */
  readonly connectionName: string;

  /** Current connection state */
  readonly state: ConnectionState;

  /** Connect to the external service */
  connect(): Promise<void>;

  /** Disconnect from the external service */
  disconnect(): Promise<void>;

  /** Health check - returns true if connection is healthy */
  isHealthy(): Promise<boolean>;

  /** Optional: Called during drain phase to complete pending work */
  drain?(): Promise<void>;
}

/**
 * Connection registration entry
 */
export interface IConnectionEntry {
  connection: IManagedConnection;
  metadata: IConnectionMetadata;
  registeredAt: Date;
}

/**
 * Shutdown manager configuration
 */
export interface IShutdownConfig {
  /** Global shutdown timeout (default: 30000ms) */
  timeout?: number;
  /** Delay before starting shutdown (for load balancer deregistration) */
  gracePeriod?: number;
  /** Enable verbose shutdown logging */
  verbose?: boolean;
}

/**
 * Readiness gate configuration
 */
export interface IReadinessConfig {
  /** Timeout for all connections to be ready (default: 30000ms) */
  timeout?: number;
  /** Interval to check connection status (default: 1000ms) */
  checkInterval?: number;
}

/**
 * Connection retry configuration
 */
export interface IRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial delay between retries (ms) */
  initialDelay: number;
  /** Maximum delay between retries (ms) */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  multiplier: number;
}
