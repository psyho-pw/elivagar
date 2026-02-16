import { faker } from '@faker-js/faker';
import { Notification, NotificationType } from '../../apps/notification/src/notification/notification.entity';

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
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
  } as unknown as Notification;
}
