import { ExecutionContext } from '@nestjs/common';

export interface MockExecutionContextOptions {
  type?: string;
  className?: string;
  methodName?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  rpcContext?: unknown;
  rpcData?: unknown;
}

export function createMockExecutionContext(
  options: MockExecutionContextOptions = {},
): ExecutionContext {
  const {
    type = 'http',
    className = 'TestController',
    methodName = 'testMethod',
    request = {},
    response = {},
    rpcContext = {},
    rpcData = {},
  } = options;

  return {
    getType: () => type,
    getClass: () => ({ name: className }),
    getHandler: () => ({ name: methodName }),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    switchToRpc: () => ({
      getContext: () => rpcContext,
      getData: () => rpcData,
    }),
  } as unknown as ExecutionContext;
}
