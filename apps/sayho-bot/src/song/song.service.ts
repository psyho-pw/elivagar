import { EntityManager, FilterQuery } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Song } from './song.entity';
import { SongRepository } from './song.repository';

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

@Injectable()
export class SongService {
  constructor(
    private readonly repository: SongRepository,
    private readonly em: EntityManager,
  ) {}

  public async create(url: string, title: string): Promise<Song> {
    const existing = await this.repository.findOne({ url });
    if (existing) {
      existing.count += 1;
      await this.em.flush();
      return existing;
    }

    const now = new Date();
    const song = this.em.create(Song, { url, title, count: 1, createdAt: now, updatedAt: now });
    await this.em.persistAndFlush(song);
    return song;
  }

  public async findAll(
    page: number,
    limit: number,
    searchText?: string,
  ): Promise<[Song[], number]> {
    const where: FilterQuery<Song> = {};
    if (searchText) {
      where.title = { $like: `%${escapeLike(searchText)}%` };
    }

    return this.repository.findAndCount(where, {
      orderBy: { createdAt: 'DESC' },
      offset: (page - 1) * limit,
      limit,
    });
  }

  public async incrementCount(url: string): Promise<void> {
    const song = await this.repository.findOne({ url });
    if (song) {
      song.count += 1;
      await this.em.flush();
    }
  }
}
