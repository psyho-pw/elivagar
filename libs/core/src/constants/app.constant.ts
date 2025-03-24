import { Union } from 'libs/core/types/union.type';

export const Env = {
  test: 'test',
  development: 'development',
  production: 'production',
} as const;

export type Env = Union<typeof Env>;
