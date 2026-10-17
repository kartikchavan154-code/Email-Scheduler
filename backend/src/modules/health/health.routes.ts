import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { ElasticsearchService } from '../search/elasticsearch.service';

const router = Router();

/**
 * GET /api/health
 * Liveness probe
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-backend',
  });
});

/**
 * GET /api/health/ready
 * Readiness probe inspecting Postgres, Redis, and Elasticsearch
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, string> = {
    database: 'down',
    redis: 'down',
    elasticsearch: 'down',
  };

  const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), ms)),
    ]);

  try {
    await timeout(prisma.$queryRaw`SELECT 1`, 2000);
    checks.database = 'healthy';
  } catch (err: any) {
    checks.database = `unhealthy (${err.message})`;
  }

  try {
    const ping = await timeout(redis.ping(), 2000);
    checks.redis = ping === 'PONG' ? 'healthy' : 'unhealthy';
  } catch (err: any) {
    checks.redis = `unhealthy (${err.message})`;
  }

  try {
    const esClient = ElasticsearchService.getClient();
    const esPing = await timeout(esClient.ping(), 2000);
    checks.elasticsearch = esPing ? 'healthy' : 'unhealthy';
  } catch (err: any) {
    checks.elasticsearch = `unhealthy (${err.message})`;
  }

  const isAllHealthy = checks.database === 'healthy' && checks.redis === 'healthy';

  res.status(isAllHealthy ? 200 : 503).json({
    status: isAllHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export const healthRouter = router;
