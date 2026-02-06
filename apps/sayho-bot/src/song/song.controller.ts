import { Public } from '@app/auth/decorators/public.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { SongService } from './song.service';

interface SongItem {
  id: string;
  url: string;
  title: string;
  count: number;
  createdAt: Date;
}

interface FindAllResponse {
  items: SongItem[];
  total: number;
}

@Controller('/songs')
export class SongController {
  constructor(private readonly service: SongService) {}

  @Public()
  @Get('/')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('searchText') searchText?: string,
  ): Promise<FindAllResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const [songs, total] = await this.service.findAll(pageNum, limitNum, searchText);

    return {
      items: songs.map((s) => ({
        id: s.id,
        url: s.url,
        title: s.title,
        count: s.count,
        createdAt: s.createdAt,
      })),
      total,
    };
  }
}
