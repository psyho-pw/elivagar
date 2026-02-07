import { Injectable } from '@nestjs/common';
import { PlayMusicUseCase } from './play-music.usecase';
import { GuildInfraStateManager } from '../infrastructure/discord-client/guild-infra-state.manager';

@Injectable()
export class LeaveChannelUseCase {
  constructor(
    private readonly playMusicUseCase: PlayMusicUseCase,
    private readonly guildInfraStateManager: GuildInfraStateManager,
  ) {}

  execute(guildId: string): void {
    this.playMusicUseCase.stop(guildId);
    this.guildInfraStateManager.clearDeleteQueue(guildId);
    this.guildInfraStateManager.cleanup(guildId);
  }
}
