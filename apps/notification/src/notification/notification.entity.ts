import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, Enum, Property } from '@mikro-orm/core';

export enum NotificationType {
  SYSTEM = 'SYSTEM',
  AUTH = 'AUTH',
  INFO = 'INFO',
}

const notificationTypeValues: ReadonlySet<string> = new Set(Object.values(NotificationType));

export function isNotificationType(value: string): value is NotificationType {
  return notificationTypeValues.has(value);
}

@Entity({ schema: 'notification' })
export class Notification extends MikroUuidEntity {
  @Property({ type: 'uuid' })
  userId!: string;

  @Property()
  title!: string;

  @Property()
  message!: string;

  @Enum(() => NotificationType)
  type: NotificationType = NotificationType.INFO;

  @Property()
  isRead: boolean = false;
}
