import { Union } from '@app/core/types/union.type';

// Injection tokens
export const CONNECTION_REGISTRY = Symbol('ConnectionRegistry');
export const READINESS_GATE = Symbol('ReadinessGate');
export const READINESS_CONFIG = Symbol('ReadinessConfig');
export const GRACE_PERIOD_CONFIG = Symbol('GracePeriodConfig');

// Standard connection names
export const ConnectionNames = {
  DATABASE: 'database',
  KAFKA: 'kafka',
  REDIS: 'redis',
  GRPC: 'grpc',
} as const;

export type ConnectionName = Union<typeof ConnectionNames>;

/**
 * Connection states for external services
 */
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTING: 'disconnecting',
  ERROR: 'error',
} as const;
export type ConnectionState = Union<typeof ConnectionState>;
