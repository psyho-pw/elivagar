import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, Property } from '@mikro-orm/core';
import { Enum } from '@mikro-orm/postgresql';
import { UserRole } from './user.constant';

@Entity({ schema: 'auth' })
export class User extends MikroUuidEntity {
  @Property({ unique: true })
  email!: string;

  @Property({ type: 'varchar', length: 255 })
  name!: string;

  @Property({ type: 'varchar', length: 255 })
  password!: string;

  @Enum({ items: () => UserRole, array: true, default: [UserRole.USER] })
  roles: UserRole[] = [UserRole.USER];
}
