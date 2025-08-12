import { getRedisClient } from '@/server/storage/redisConnection';
import { DataStore } from '@/server/storage/interfaces';
import logger from '@/server/logger';

export class RedisDataStore implements DataStore {
  private readonly client = (() => {
    try {
      return getRedisClient();
    } catch {
      logger.warn('Redis not available — RedisDataStore will be disabled.');
      return null;
    }
  })();

  async hset(key: string, values: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not initialized');
    }
    await this.client.hset(key, values);
  }

  async hgetall(key: string): Promise<Record<string, any>> {
    if (!this.client) {
      throw new Error('Redis not initialized');
    }
    return this.client.hgetall(key);
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis not initialized');
    }
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not initialized');
    }
    await this.client.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
  if (!this.client) {
    throw new Error('Redis not initialized');
  }
  await this.client.setex(key, seconds, value);
}

  async del(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not initialized');
    }
    await this.client.del(key);
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const forceQuitTimeout = setTimeout(() => {
        logger.warn('Redis connection close timed out, forcing quit');
        this.client?.disconnect(false);
      }, 5000);

      await this.client.quit();
      clearTimeout(forceQuitTimeout);
      logger.debug('Redis connection closed successfully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
}

export const storage = new RedisDataStore();
