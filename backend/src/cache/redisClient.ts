import Redis from 'ioredis';
import { config } from '../config';

class CacheService {
  private redis: Redis | null = null;
  private memoryStore: Map<string, { data: string; expiry: number }> = new Map();
  private isRedisConnected = false;

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 3) return null; // stop reconnecting if no redis instance
          return Math.min(times * 200, 1000);
        }
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
        console.log('✅ Connected to Redis cache service.');
      });

      this.redis.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn('⚠️ Redis error, falling back to in-memory caching:', err.message);
        }
        this.isRedisConnected = false;
      });
    } catch (e) {
      console.warn('⚠️ Redis unavailable. Using high-performance memory cache.');
      this.isRedisConnected = false;
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisConnected && this.redis) {
        const val = await this.redis.get(key);
        if (val) return JSON.parse(val) as T;
      }
    } catch (err) {
      // fallback to memory
    }

    const item = this.memoryStore.get(key);
    if (item) {
      if (Date.now() > item.expiry) {
        this.memoryStore.delete(key);
        return null;
      }
      return JSON.parse(item.data) as T;
    }

    return null;
  }

  public async set(key: string, value: any, ttlSeconds = config.redisTtlSeconds): Promise<void> {
    const stringified = JSON.stringify(value);
    try {
      if (this.isRedisConnected && this.redis) {
        await this.redis.set(key, stringified, 'EX', ttlSeconds);
      }
    } catch (err) {
      // fallback to memory
    }

    this.memoryStore.set(key, {
      data: stringified,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  public async delete(key: string): Promise<void> {
    try {
      if (this.isRedisConnected && this.redis) {
        await this.redis.del(key);
      }
    } catch (err) {
      // fallback
    }
    this.memoryStore.delete(key);
  }

  public getStatus() {
    return {
      connectedToRedis: this.isRedisConnected,
      memoryEntriesCount: this.memoryStore.size
    };
  }
}

export const cacheService = new CacheService();
