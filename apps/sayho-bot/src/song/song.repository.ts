import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Song } from './song.entity';

@Injectable()
export class SongRepository extends EntityRepository<Song> {}
