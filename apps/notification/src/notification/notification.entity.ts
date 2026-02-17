import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, Enum, Property } from '@mikro-orm/core';
import { NotificationType } from './notification.constant';

@Entity({ schema: 'notification' })
export class Notification extends MikroUuidEntity {
  constructor(data?: Partial<Notification>) {
    super(data);
  }

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
