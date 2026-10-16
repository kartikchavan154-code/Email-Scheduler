import { emailWorker } from './workers/email.worker';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { emailQueue } from './modules/queue/email.queue';

async function runWorkerProcess() {
  logger.info('🚀 Launching standalone ReachInbox BullMQ Email Worker Process...');

  const worker = emailWorker.start();

  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}. Shutting down worker gracefully...`);
    await emailWorker.stop();
    await emailQueue.close();
    await redis.quit();
    await prisma.$disconnect();
    logger.info('Worker process exit clean.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

runWorkerProcess().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Fatal error in worker process');
  process.exit(1);
});
