// Injection tokens
export const CONNECTION_REGISTRY = Symbol('CONNECTION_REGISTRY');
export const READINESS_GATE = Symbol('READINESS_GATE');
export const READINESS_CONFIG = Symbol('READINESS_CONFIG');
export const GRACE_PERIOD_CONFIG = Symbol('GRACE_PERIOD_CONFIG');

// Standard connection names
export const ConnectionNames = {
  DATABASE: 'database',
  KAFKA: 'kafka',
  REDIS: 'redis',
  GRPC: 'grpc',
} as const;

export type ConnectionName = (typeof ConnectionNames)[keyof typeof ConnectionNames];
