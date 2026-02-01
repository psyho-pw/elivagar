import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, EntityRepositoryType, Property, TextType } from '@mikro-orm/postgresql';
import { SongRepository } from './song.repository';

@Entity({ schema: 'sayho', repository: () => SongRepository })
export class Song extends MikroUuidEntity {
  [EntityRepositoryType]?: SongRepository;

  @Property({ type: TextType, nullable: false })
  url: string = '';

  @Property({ type: TextType, nullable: false })
  title: string = '';

  @Property({ columnType: 'int', nullable: false, default: 0 })
  count: number = 0;
}
