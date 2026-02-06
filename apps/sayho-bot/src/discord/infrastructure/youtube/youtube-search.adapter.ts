import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { Inject, Injectable } from '@nestjs/common';
import Youtube, { Video } from 'simple-youtube-api';
import { IYoutubeSearch, PlaylistInfo, VideoInfo } from '../../domain/ports/youtube-search.port';

@Injectable()
export class YoutubeSearchAdapter implements IYoutubeSearch {
  private readonly youtube: Youtube;

  constructor(
    @Inject(ConfigsServiceKey)
    private readonly configsService: ConfigsService,
  ) {
    this.youtube = new Youtube(this.configsService.YoutubeConfig.youtubeApiKey);
  }

  async searchVideos(query: string, limit = 5): Promise<VideoInfo[]> {
    const results = await this.youtube.searchVideos(query, limit);

    return results
      .filter((result): result is Video => result.type === 'video')
      .map((video) => this.mapToVideoInfo(video));
  }

  async getVideo(url: string): Promise<VideoInfo | null> {
    try {
      const video = await this.youtube.getVideo(url);
      if (!video) {
        return null;
      }
      return this.mapToVideoInfo(video);
    } catch {
      return null;
    }
  }

  async getPlaylist(url: string): Promise<PlaylistInfo | null> {
    try {
      const playlist = await this.youtube.getPlaylist(url);
      if (!playlist) {
        return null;
      }

      const videos = await playlist.getVideos(100);

      return {
        id: playlist.id,
        title: playlist.title,
        url: playlist.url,
        videos: videos.map((video) => this.mapToVideoInfo(video)),
      };
    } catch {
      return null;
    }
  }

  private mapToVideoInfo(video: Video): VideoInfo {
    return {
      id: video.id,
      title: video.title,
      url: video.url,
      shortUrl: video.shortURL,
      thumbnail: video.thumbnails?.high?.url ?? video.thumbnails?.default?.url ?? '',
      durationSeconds: video.durationSeconds ?? 0,
    };
  }
}
