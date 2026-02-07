export interface SongResult {
  id: string;
  url: string;
  title: string;
  count: number;
  createdAt: Date;
}

export interface SongListResult {
  items: SongResult[];
  total: number;
}
