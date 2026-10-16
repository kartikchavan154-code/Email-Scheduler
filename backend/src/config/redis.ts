import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const getRedisOptions = (): RedisOptions => ({
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err) {
    logger.warn({ err: err.message }, 'Redis reconnect on error');
    return true;
  },
});

export const createRedisClient = (customName?: string): Redis => {
  const client = new Redis(env.REDIS_URL, {
    ...getRedisOptions(),
    connectionName: customName || 'reachinbox_redis',
  });

  client.on('connect', () => {
    logger.info({ name: customName || 'reachinbox_redis' }, 'Connected to Redis successfully');
  });

  client.on('error', (err) => {
    logger.error({ err: err.message, name: customName }, 'Redis connection error');
  });

  return client;
};

// Default shared client instance for rate limits and locks
export const redis = createRedisClient('reachinbox_shared');
