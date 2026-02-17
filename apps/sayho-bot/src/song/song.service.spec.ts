import { faker } from '@faker-js/faker';
import { TestBed, Mocked } from '@suites/unit';
import { makeSong } from '@test/factories/song.factory';
import { SongRepository } from './song.repository';
import { SongService } from './song.service';

describe('SongService', () => {
  let service: SongService;
  let repository: Mocked<SongRepository>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SongService).compile();

    service = unit;
    repository = unitRef.get(SongRepository);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should increment count and return existing song if URL exists', async () => {
      const url = faker.internet.url();
      const title = faker.music.songName();
      const existing = makeSong({ url, count: 3 });
      repository.findOne.mockResolvedValue(existing);

      const result = await service.create(url, title);

      expect(existing.count).toBe(4);
      expect(result).toEqual({
        id: existing.id,
        url: existing.url,
        title: existing.title,
        count: 4,
        createdAt: existing.createdAt,
      });
    });

    it('should create a new song if URL does not exist', async () => {
      const url = faker.internet.url();
      const title = faker.music.songName();
      repository.findOne.mockResolvedValue(null);
      const newSong = makeSong({ url, title });
      repository.create.mockReturnValue(newSong);

      const result = await service.create(url, title);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url,
          title,
          count: 1,
        }),
      );
      expect(result).toEqual({
        id: newSong.id,
        url: newSong.url,
        title: newSong.title,
        count: newSong.count,
        createdAt: newSong.createdAt,
      });
    });

    it('should pass createdAt and updatedAt as Date instances when creating', async () => {
      const url = faker.internet.url();
      const title = faker.music.songName();
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(makeSong());

      await service.create(url, title);

      const createArg = repository.create.mock.calls[0][0] as Record<string, unknown>;
      expect(createArg.createdAt).toBeInstanceOf(Date);
      expect(createArg.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should return paginated songs without search text', async () => {
      const song1 = makeSong();
      const song2Id = faker.string.uuid();
      const song2Title = faker.music.songName();
      const song2 = makeSong({ id: song2Id, title: song2Title });
      const songs = [song1, song2];
      repository.findAndCount.mockResolvedValue([songs, 2]);

      const result = await service.findAll(1, 20);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        {},
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 20 },
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply search filter when searchText is provided', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 10, 'rock');

      expect(repository.findAndCount).toHaveBeenCalledWith(
        { title: { $like: '%rock%' } },
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 10 },
      );
    });

    it('should escape LIKE wildcard characters in searchText', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 10, '100%_match\\test');

      expect(repository.findAndCount).toHaveBeenCalledWith(
        { title: { $like: '%100\\%\\_match\\\\test%' } },
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 10 },
      );
    });

    it('should calculate correct offset for page 3 with limit 10', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(3, 10);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ offset: 20, limit: 10 }),
      );
    });
  });

  describe('incrementCount', () => {
    it('should increment count when song is found', async () => {
      const url = faker.internet.url();
      const song = makeSong({ url, count: 5 });
      repository.findOne.mockResolvedValue(song);

      await service.incrementCount(url);

      expect(song.count).toBe(6);
    });

    it('should do nothing when song is not found', async () => {
      const url = faker.internet.url();
      repository.findOne.mockResolvedValue(null);

      await service.incrementCount(url);
    });
  });
});
