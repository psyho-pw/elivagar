import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { v7 } from 'uuid';

@Entity({ abstract: true })
export class MikroEntity {
  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  deletedAt: Date | null = null;

  protected constructor(data?: Partial<MikroEntity>) {
    if (data) Object.assign(this, data);
  }
}

@Entity({ abstract: true })
export class MikroUuidEntity extends MikroEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = v7();
}

@Entity({ abstract: true })
export class MikroAutoIncrementEntity extends MikroEntity {
  @PrimaryKey({ type: 'int', autoincrement: true })
  id: number = 0;
}

@Entity({ abstract: true })
export class MikroUuidActorEntity extends MikroUuidEntity {
  @Property({ type: 'uuid' })
  createdBy!: string;

  @Property({ type: 'uuid' })
  updatedBy!: string;
}

@Entity({ abstract: true })
export class MikroAutoIncrementActorEntity extends MikroAutoIncrementEntity {
  @Property({ type: 'uuid' })
  createdBy!: string;

  @Property({ type: 'uuid' })
  updatedBy!: string;
}
