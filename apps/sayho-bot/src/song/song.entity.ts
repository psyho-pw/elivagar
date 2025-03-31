import { MikroUuidEntity } from '@app/core/mikro/abstracts/base.entity';
import { Entity, EntityRepositoryType, Property, TextType } from '@mikro-orm/mariadb';
import { SongRepository } from './song.repository';

@Entity({ repository: () => SongRepository })
export class Song extends MikroUuidEntity {
  [EntityRepositoryType]?: SongRepository;

  @Property({ type: TextType, nullable: false })
  url: string = '';

  @Property({ type: TextType, nullable: false })
  title: string = '';

  @Property({ columnType: 'int', nullable: false, default: 0 })
  count: number = 0;
}
