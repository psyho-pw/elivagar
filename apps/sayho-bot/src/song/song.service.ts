import { Injectable } from '@nestjs/common';
import { SongRepository } from './song.repository';

@Injectable()
export class SongService {
  constructor(private readonly repository: SongRepository) {}
}
