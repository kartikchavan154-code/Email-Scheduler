import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { emailQueue } from './modules/queue/email.queue';
import { ElasticsearchService } from './modules/search/elasticsearch.service';
import { ReconciliationService } from './modules/scheduling/reconciliation.service';
import { emailWorker } from './workers/email.worker';

async function bootstrap() {
  const app = createApp();

  // 1. Initialize Elasticsearch index mappings
  await ElasticsearchService.initializeIndex().catch((err) => {
    logger.warn({ err: err.message }, 'Elasticsearch index initialization deferred');
  });

  // 2. Persistent Restart Recovery: Run one-time startup reconciliation
  await ReconciliationService.reconcileOnStartup().catch((err) => {
    logger.error({ err: err.message }, 'Reconciliation on startup encountered error');
  });

  // 3. In single-process development mode, also start the worker automatically
  if (process.env.RUN_STANDALONE_WORKER !== 'true') {
    emailWorker.start();
  }

  // 4. Start HTTP Server
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 ReachInbox API server listening on http://localhost:${env.PORT}`);
    logger.info(`📊 Bull Board Queue Monitor mounted at http://localhost:${env.PORT}/admin/queues`);
    logger.info(`🔗 Connected to Frontend at ${env.FRONTEND_URL}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await emailWorker.stop();
      await emailQueue.close();
      await redis.quit();
      await prisma.$disconnect();
      logger.info('All connections closed. Exit complete.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Fatal error during server startup');
  process.exit(1);
});
