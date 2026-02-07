import { Injectable } from '@nestjs/common';
import { DiscordAudioPlayer } from './voice-connection.adapter';
import {
  AudioPlayerEvents,
  IAudioPlayer,
  IAudioPlayerFactory,
} from '../../domain/ports/audio-player.port';

@Injectable()
export class DiscordAudioPlayerFactory implements IAudioPlayerFactory {
  createPlayer(events: AudioPlayerEvents): IAudioPlayer {
    return new DiscordAudioPlayer(events);
  }
}
