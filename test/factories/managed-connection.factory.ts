import { ConnectionState } from '@app/core/lifecycle/lifecycle.constant';
import { IManagedConnection } from '@app/core/lifecycle/lifecycle.interface';

export function createMockConnection(
  name: string,
  overrides: Partial<IManagedConnection> = {},
): jest.Mocked<IManagedConnection> {
  return {
    connectionName: name,
    state: ConnectionState.CONNECTED,
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as jest.Mocked<IManagedConnection>;
}
