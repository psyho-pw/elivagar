import { MikroUuidEntity } from '@app/mikro/abstracts/base.entity';
import { Entity, EntityRepositoryType, Index, Property, TextType } from '@mikro-orm/postgresql';
import { SongRepository } from './song.repository';

@Entity({ schema: 'sayho', repository: () => SongRepository })
export class Song extends MikroUuidEntity {
  [EntityRepositoryType]?: SongRepository;

  constructor(data?: Partial<Song>) {
    super(data);
  }

  @Property({ type: TextType, nullable: false })
  url!: string;

  @Index({
    name: 'song_title_trgm_idx',
    type: 'gin',
    expression:
      'create index "song_title_trgm_idx" on "sayho"."song" using gin ("title" gin_trgm_ops)',
  })
  @Property({ type: TextType, nullable: false })
  title!: string;

  @Property({ type: 'integer', nullable: false, default: 0 })
  count!: number;
}
