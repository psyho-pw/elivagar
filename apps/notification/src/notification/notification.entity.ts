import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, EntityRepositoryType, Enum, Property } from '@mikro-orm/postgresql';
import { NotificationType } from './notification.constant';
import { NotificationRepository } from './notification.repository';

@Entity({ schema: 'notification', repository: () => NotificationRepository })
export class Notification extends MikroUuidEntity {
  [EntityRepositoryType]?: NotificationRepository;

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
