import { Union } from '@app/core/types/union.type';

export const NotificationType = {
  SYSTEM: 'SYSTEM',
  AUTH: 'AUTH',
  INFO: 'INFO',
} as const;
export type NotificationType = Union<typeof NotificationType>;

const notificationTypeValues: ReadonlySet<string> = new Set(Object.values(NotificationType));

export function isNotificationType(value: string): value is NotificationType {
  return notificationTypeValues.has(value);
}
