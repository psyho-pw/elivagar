import { MikroAutoIncrementEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, Property } from '@mikro-orm/core';

@Entity({ schema: 'auth' })
export class User extends MikroAutoIncrementEntity {
  @Property({ unique: true })
  email!: string;

  @Property()
  password!: string;
}
