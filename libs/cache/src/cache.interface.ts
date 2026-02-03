import { CacheKeyType } from './cache.constant';

export interface ICacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface CacheModuleOptions {
  /** Database number (default: 0) */
  db?: number;
  /** Custom provider token for multi-instance scenarios */
  providerToken?: symbol;
  /** Key prefix namespace */
  namespace?: string;
  /** Default TTL in milliseconds */
  ttl?: number;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<number>;
  clear(): Promise<void>;

  // Sorted set operations (requires raw Redis client - may throw if unavailable)
  zAdd(key: string, score: number, member: string): Promise<number>;
  zRevRank(key: string, member: string): Promise<number | null>;
  zCard(key: string): Promise<number>;

  // Single-flight/coalescing wrapper
  wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T>;
}

// Cache decorator options
interface CacheOptionsBase {
  /** Cache key (prefix) */
  key: string;
  /** TTL in milliseconds */
  ttl?: number;
  /** Invalidate existing cache before execution */
  invalidateExisting?: boolean;
  /** Condition function to determine if caching should apply */
  condition?: (...args: unknown[]) => boolean;
  /** Enable single-flight pattern (coalescing) */
  useSingleFlight?: boolean;
}

interface CacheOptionsPlain extends CacheOptionsBase {
  type: typeof CacheKeyType.Plain;
}

interface CacheOptionsSuffix extends CacheOptionsBase {
  type: typeof CacheKeyType.Suffix;
  /** Use method argument ID as suffix (true = index 0, { index: N } for specific index) */
  useIdSuffix?: boolean | { index: number };
  /** Use CacheableQuery suffix */
  useCacheableSuffix?: boolean;
}

export type CacheOptions = CacheOptionsPlain | CacheOptionsSuffix;

/** Interface for objects that can generate cache suffixes */
export interface CacheableQuery {
  toCachePayload(): Record<string, unknown>;
}
