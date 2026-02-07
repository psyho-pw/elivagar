declare module 'simple-youtube-api' {
  interface Duration {
    hours: number;
    minutes: number;
    seconds: number;
  }

  interface ThumbnailData {
    url: string;
  }

  type Thumbnail = Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', ThumbnailData>;

  interface SimpleYoutubeAPIBase {
    raw: Record<string, unknown>;
    full: boolean;
    kind: string;
    id: string;
    title: string;
    description: string;
    thumbnails: Thumbnail;
    publishedAt: Date;
    channel: Channel;
    duration?: Duration;
  }

  interface Channel extends SimpleYoutubeAPIBase {
    type: 'channel';
    url: string;
    fetch(options?: Record<string, unknown>): Channel;
  }

  interface Video extends SimpleYoutubeAPIBase {
    type: 'video';
    url: string;
    shortURL: string;
    durationSeconds: number;
    fetch(options?: Record<string, unknown>): Video;
  }

  interface PlayList extends SimpleYoutubeAPIBase {
    type: 'playlist';
    videos: Array<Video>;
    url: string;
    fetch(options?: Record<string, unknown>): PlayList;
    getVideos(limit?: number, options?: Record<string, unknown>): Promise<Video[]>;
  }

  export default class YouTube {
    constructor(key: string);
    searchVideos(
      query?: string,
      limit?: number,
      options?: Record<string, unknown>,
    ): Promise<Array<Channel | Video>>;
    getPlaylist(url: string, options?: Record<string, unknown>): Promise<PlayList>;
    getVideo(url: string, options?: Record<string, unknown>): Promise<Video>;
  }
}

declare module 'simple-youtube-api/src/index.js' {
  export { default } from 'simple-youtube-api';
}
