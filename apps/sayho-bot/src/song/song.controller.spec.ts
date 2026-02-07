import { faker } from '@faker-js/faker';
import { TestBed, Mocked } from '@suites/unit';
import { SongController } from './song.controller';
import { SongService } from './song.service';

describe('SongController', () => {
  let controller: SongController;
  let songService: Mocked<SongService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SongController).compile();

    controller = unit;
    songService = unitRef.get(SongService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return items and total from service', async () => {
      const songId = faker.string.uuid();
      const songUrl = faker.internet.url();
      const songTitle = faker.music.songName();
      const songCount = faker.number.int({ min: 1, max: 100 });
      const songDate = faker.date.recent();
      const song2Id = faker.string.uuid();
      const song2Title = faker.music.songName();
      const song2Count = faker.number.int({ min: 1, max: 100 });
      const song2Date = faker.date.recent();
      songService.findAll.mockResolvedValue({
        items: [
          { id: songId, url: songUrl, title: songTitle, count: songCount, createdAt: songDate },
          { id: song2Id, url: faker.internet.url(), title: song2Title, count: song2Count, createdAt: song2Date },
        ],
        total: 2,
      });

      const result = await controller.findAll('1', '20');

      expect(songService.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: songId,
        url: songUrl,
        title: songTitle,
        count: songCount,
        createdAt: songDate,
      });
    });

    it('should default to page 1 and limit 20 when params are undefined', async () => {
      songService.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll(undefined, undefined);

      expect(songService.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should pass searchText to service when provided', async () => {
      songService.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll('2', '10', 'rock');

      expect(songService.findAll).toHaveBeenCalledWith(2, 10, 'rock');
    });

    it('should fallback to defaults when page/limit are non-numeric strings', async () => {
      songService.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll('abc', 'xyz');

      expect(songService.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should not include updatedAt or deletedAt in response items', async () => {
      const songDate = faker.date.recent();
      songService.findAll.mockResolvedValue({
        items: [
          {
            id: faker.string.uuid(),
            url: faker.internet.url(),
            title: faker.music.songName(),
            count: 1,
            createdAt: songDate,
          },
        ],
        total: 1,
      });

      const result = await controller.findAll();

      expect(result.items[0]).not.toHaveProperty('updatedAt');
      expect(result.items[0]).not.toHaveProperty('deletedAt');
    });
  });
});
