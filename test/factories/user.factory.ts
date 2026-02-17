import { faker } from '@faker-js/faker';
import { plainToInstance } from 'class-transformer';
import { User } from '../../apps/auth/src/user/user.entity';

export function makeUser(overrides: Partial<User> = {}): User {
  return plainToInstance(User, {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    password: faker.string.alphanumeric(60),
    roles: ['user'],
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  });
}
