import { Public } from '@app/auth/decorators/public.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { SongListResult } from './song.interface';
import { SongService } from './song.service';

@Controller('/songs')
export class SongController {
  constructor(private readonly service: SongService) {}

  @Public()
  @Get('/')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('searchText') searchText?: string,
  ): Promise<SongListResult> {
    const pageNum = page ? parseInt(page, 10) || 1 : 1;
    const limitNum = limit ? parseInt(limit, 10) || 20 : 20;

    return this.service.findAll(pageNum, limitNum, searchText);
  }
}
