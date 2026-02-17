import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, EntityRepositoryType, Enum, Property } from '@mikro-orm/postgresql';
import { UserRepository } from './user.repository';
import { UserRole } from './user.constant';

@Entity({ schema: 'auth', repository: () => UserRepository })
export class User extends MikroUuidEntity {
  [EntityRepositoryType]?: UserRepository;

  constructor(data?: Partial<User>) {
    super(data);
  }

  @Property({ unique: true })
  email!: string;

  @Property({ type: 'varchar', length: 255 })
  name!: string;

  @Property({ type: 'varchar', length: 255 })
  password!: string;

  @Enum({ items: () => UserRole, array: true, default: [UserRole.USER] })
  roles: UserRole[] = [UserRole.USER];
}
