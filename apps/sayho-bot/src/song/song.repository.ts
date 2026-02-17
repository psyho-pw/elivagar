import { EntityRepository } from '@mikro-orm/postgresql';
import { Song } from './song.entity';

export class SongRepository extends EntityRepository<Song> {}
