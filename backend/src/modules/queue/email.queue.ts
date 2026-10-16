import { Queue, JobsOptions } from 'bullmq';
import { getRedisOptions } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { EmailJobData } from '../../types';

export const EMAIL_QUEUE_NAME = 'email-sending-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: {
    host: new URL(env.REDIS_URL).hostname,
    port: Number(new URL(env.REDIS_URL).port || 6379),
    password: new URL(env.REDIS_URL).password || undefined,
    ...getRedisOptions(),
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep 24 hours
      count: 5000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep 7 days
    },
  },
});

emailQueue.on('error', (err) => {
  logger.error({ err: err.message }, 'BullMQ Email Queue Error');
});
