import type { RedisOptions } from 'ioredis';

export interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface RedisModuleOptions {
  /** Custom key prefix */
  keyPrefix?: string;
  /** Database number (default: 0) */
  db?: number;
  /** Additional ioredis options */
  options?: Partial<RedisOptions>;
}
