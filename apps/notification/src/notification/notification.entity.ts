import { MikroAutoIncrementEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, Property } from '@mikro-orm/core';

@Entity({ schema: 'notification' })
export class Notification extends MikroAutoIncrementEntity {
  @Property()
  userId!: number;

  @Property()
  title!: string;

  @Property()
  message!: string;

  @Property()
  isRead: boolean = false;
}
