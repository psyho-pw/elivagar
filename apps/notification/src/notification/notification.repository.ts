import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationRepository extends EntityRepository<Notification> {}
