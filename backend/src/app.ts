import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { logger } from './config/logger';

// Routes
import { authRouter } from './modules/auth/auth.routes';
import { emailRouter } from './modules/emails/email.routes';
import { senderRouter } from './modules/senders/sender.routes';
import { batchRouter } from './modules/batches/batch.routes';
import { slackRouter } from './modules/slack/slack.routes';
import { healthRouter } from './modules/health/health.routes';
import { setupBullBoard } from './modules/queue/bull-board';

export function createApp() {
  const app = express();

  // Trust first proxy (Render load balancer) so req.secure and HTTPS cookies work properly
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Bull Board UI and external resources
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (!req.path.startsWith('/admin/queues') && !req.path.startsWith('/api/health')) {
        logger.info(
          {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: duration,
          },
          'HTTP Request'
        );
      }
    });
    next();
  });

  // Bull Board queue dashboard
  const bullBoard = setupBullBoard();
  app.use('/admin/queues', bullBoard.basicAuthMiddleware, bullBoard.router);

  // API Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/emails', emailRouter);
  app.use('/api/senders', senderRouter);
  app.use('/api/batches', batchRouter);
  app.use('/api/slack', slackRouter);

  // Global 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack, path: req.path }, 'Unhandled API Error');
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
      },
    });
  });

  return app;
}
