import { faker } from '@faker-js/faker';
import { User } from '../../apps/auth/src/user/user.entity';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    password: faker.string.alphanumeric(60),
    roles: ['user'],
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as unknown as User;
}
