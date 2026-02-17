import { EntityRepository } from '@mikro-orm/postgresql';
import { Notification } from './notification.entity';

export class NotificationRepository extends EntityRepository<Notification> {}
