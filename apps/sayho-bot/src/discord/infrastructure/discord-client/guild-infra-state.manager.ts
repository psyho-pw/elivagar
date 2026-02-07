import { Injectable } from '@nestjs/common';
import { InteractionResponse, Message } from 'discord.js';
import { IAudioPlayer } from '../../domain/ports/audio-player.port';
import { SentMessage } from '../../domain/ports/message-sender.port';

class GuildInfraState {
  player: IAudioPlayer | null = null;
  currentInfoMessage: SentMessage | null = null;
  deleteQueue = new Map<string, Message | InteractionResponse>();

  reset(): void {
    this.player = null;
    this.currentInfoMessage = null;
    this.deleteQueue.clear();
  }
}

@Injectable()
export class GuildInfraStateManager {
  private readonly states = new Map<string, GuildInfraState>();

  private getOrCreate(guildId: string): GuildInfraState {
    let state = this.states.get(guildId);
    if (!state) {
      state = new GuildInfraState();
      this.states.set(guildId, state);
    }
    return state;
  }

  // Player
  getPlayer(guildId: string): IAudioPlayer | null {
    return this.states.get(guildId)?.player ?? null;
  }

  setPlayer(guildId: string, player: IAudioPlayer): void {
    this.getOrCreate(guildId).player = player;
  }

  deletePlayer(guildId: string): void {
    const state = this.states.get(guildId);
    if (state) state.player = null;
  }

  // Now-playing message
  getCurrentInfoMessage(guildId: string): SentMessage | null {
    return this.states.get(guildId)?.currentInfoMessage ?? null;
  }

  setCurrentInfoMessage(guildId: string, msg: SentMessage): void {
    this.getOrCreate(guildId).currentInfoMessage = msg;
  }

  deleteCurrentInfoMessage(guildId: string): void {
    const state = this.states.get(guildId);
    if (state) {
      state.currentInfoMessage?.delete().catch(() => {});
      state.currentInfoMessage = null;
    }
  }

  // Delete queue (select menu message tracking)
  addToDeleteQueue(guildId: string, msg: Message | InteractionResponse): void {
    this.getOrCreate(guildId).deleteQueue.set(msg.id, msg);
  }

  removeFromDeleteQueue(guildId: string, id: string): void {
    const state = this.states.get(guildId);
    if (state) {
      state.deleteQueue
        .get(id)
        ?.delete()
        .catch(() => {});
      state.deleteQueue.delete(id);
    }
  }

  clearDeleteQueue(guildId: string): void {
    const state = this.states.get(guildId);
    if (state) {
      state.deleteQueue.forEach((msg) => msg.delete().catch(() => {}));
      state.deleteQueue.clear();
    }
  }

  // Full cleanup
  cleanup(guildId: string): void {
    const state = this.states.get(guildId);
    if (state) {
      state.currentInfoMessage?.delete().catch(() => {});
      state.deleteQueue.forEach((msg) => msg.delete().catch(() => {}));
      state.reset();
    }
  }
}
