import { Module } from '@nestjs/common';
import { SongController } from './song.controller';
import { SongService } from './song.service';

@Module({
  // imports: [MikroOrmModule.forFeature([Song])],
  controllers: [SongController],
  providers: [SongService],
  exports: [SongService],
})
export class SongModule {}
