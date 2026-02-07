import { Injectable } from '@nestjs/common';
import { QueueStateManager } from './queue-state.manager';
import { Song } from '../domain/entities/song';

@Injectable()
export class ManageQueueUseCase {
  constructor(private readonly queueStateManager: QueueStateManager) {}

  getQueue(guildId: string): readonly Song[] {
    const queueState = this.queueStateManager.get(guildId);
    return queueState?.queue ?? [];
  }

  getCurrentSong(guildId: string): Song | undefined {
    return this.queueStateManager.get(guildId)?.currentSong;
  }

  shuffle(guildId: string): void {
    this.queueStateManager.getOrCreate(guildId).shuffle();
  }

  clearQueue(guildId: string): void {
    const queueState = this.queueStateManager.get(guildId);
    if (!queueState) return;

    const current = queueState.currentSong;
    queueState.clear();
    if (current) {
      queueState.addSong(current);
    }
  }

  isPlaying(guildId: string): boolean {
    return this.queueStateManager.get(guildId)?.isPlaying ?? false;
  }
}
