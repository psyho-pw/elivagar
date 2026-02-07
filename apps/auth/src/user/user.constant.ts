import { Union } from '@app/core/types/union.type';

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
} as const;
export type UserRole = Union<typeof UserRole>;
