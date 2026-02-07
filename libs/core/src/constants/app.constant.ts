import { Union } from '@app/core/types/union.type';

export const Env = {
  test: 'test',
  local: 'local',
  production: 'production',
} as const;
export type Env = Union<typeof Env>;

export const AppName = {
  Auth: 'auth',
  SayhoBot: 'sayho-bot',
  Notification: 'notification',
} as const;
export type AppName = Union<typeof AppName>;
