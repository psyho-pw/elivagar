import { faker } from '@faker-js/faker';
import { plainToInstance } from 'class-transformer';
import { Song } from '../../apps/sayho-bot/src/song/song.entity';

export function makeSong(overrides: Partial<Song> = {}): Song {
  return plainToInstance(Song, {
    id: faker.string.uuid(),
    url: faker.internet.url(),
    title: faker.music.songName(),
    count: faker.number.int({ min: 1, max: 100 }),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  });
}
