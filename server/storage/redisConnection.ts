import IORedis from 'ioredis';
import type { Redis } from 'ioredis';

import { getConfig } from '@/server/config';
import { logger } from '@/server/logger';

let redisClient: Redis | null = null;

/**
 * Returns a singleton Redis client, throwing if connection config is invalid
 * Must be wrapped in try/catch at usage sites
 */
export const getRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const config = getConfig();
  const isElastiCache = (config.redis.host || '').endsWith('.cache.amazonaws.com');

  redisClient = new IORedis({
    host: config.redis.host || 'redis',
    port: parseInt(config.redis.port, 10) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(isElastiCache && {
      tls: { rejectUnauthorized: false },
    }),
    ...(!isElastiCache &&
      config.redis.password && {
        password: config.redis.password,
      }),
    retryStrategy: (times) => {
      const maxRetries = 5;
      if (times > maxRetries) {
        logger.error(`Redis retry limit exceeded (${maxRetries}), giving up.`);
        return null;
      }

      const delay = Math.min(times * 100, 2000);
      logger.warn(`Retrying Redis connection... attempt ${times}`);
      return delay;
    },
    reconnectOnError: (err) => {
      logger.warn('Redis reconnectOnError triggered:', err.message);
      return true;
    },
  });

  redisClient.on('error', (error) => {
    logger.error('Redis error:', error);
  });

  redisClient.on('connect', () => {
    logger.debug('Redis connected');
  });

  redisClient.on('ready', () => {
    logger.debug('Redis ready');
  });

  return redisClient;
};

/**
* Tries to get the Redis client and verifies connectivity
* Returns null if Redis is not available or not responding
*/
export const tryGetRedisClient = async (): Promise<Redis | null> => {
  try {
    const redisClient = getRedisClient();
    
    try {
      await redisClient.ping();
      return redisClient; 
    } catch {
      return null;
    }
  } catch {
    return null;
  }
};
 