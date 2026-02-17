import { Transactional } from '@mikro-orm/core';
import { FilterQuery } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Song } from './song.entity';
import { SongListResult, SongResult } from './song.interface';
import { SongRepository } from './song.repository';

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

@Injectable()
export class SongService {
  constructor(private readonly repository: SongRepository) {}

  @Transactional()
  public async create(url: string, title: string): Promise<SongResult> {
    const existing = await this.repository.findOne({ url });
    if (existing) {
      existing.count += 1;
      return this.toResult(existing);
    }

    const now = new Date();
    const song = this.repository.create({ url, title, count: 1, createdAt: now, updatedAt: now });
    return this.toResult(song);
  }

  public async findAll(page: number, limit: number, searchText?: string): Promise<SongListResult> {
    const where: FilterQuery<Song> = {};
    if (searchText) {
      where.title = { $like: `%${escapeLike(searchText)}%` };
    }

    const [songs, total] = await this.repository.findAndCount(where, {
      orderBy: { createdAt: 'DESC' },
      offset: (page - 1) * limit,
      limit,
    });

    return {
      items: songs.map((song) => this.toResult(song)),
      total,
    };
  }

  private toResult(song: Song): SongResult {
    return {
      id: song.id,
      url: song.url,
      title: song.title,
      count: song.count,
      createdAt: song.createdAt,
    };
  }

  @Transactional()
  public async incrementCount(url: string): Promise<void> {
    const song = await this.repository.findOne({ url });
    if (song) {
      song.count += 1;
    }
  }
}
