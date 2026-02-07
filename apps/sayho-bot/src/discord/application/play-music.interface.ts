import { Song, VoiceChannelInfo } from '../domain/entities/song';

export interface PlayMusicRequest {
  guildId: string;
  songs: Song[];
  voiceChannel: VoiceChannelInfo;
  channelId: string;
}

export interface PlayMusicResult {
  started: boolean;
  queuePosition: number;
  totalInQueue: number;
}

export interface SkipResult {
  skipped: boolean;
  nextSong: Song | null;
  queueEmpty: boolean;
}
