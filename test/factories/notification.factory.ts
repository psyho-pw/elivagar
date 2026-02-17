import { faker } from '@faker-js/faker';
import { plainToInstance } from 'class-transformer';
import { NotificationType } from '../../apps/notification/src/notification/notification.constant';
import { Notification } from '../../apps/notification/src/notification/notification.entity';

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return plainToInstance(Notification, {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    title: faker.lorem.sentence(),
    message: faker.lorem.paragraph(),
    type: NotificationType.INFO,
    isRead: false,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  });
}
