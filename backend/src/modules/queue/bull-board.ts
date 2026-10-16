import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './email.queue';
import { env } from '../../config/env';
import { Request, Response, NextFunction } from 'express';

export function setupBullBoard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  // Basic authentication middleware for Bull Board queue monitor
  const basicAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Queue Monitor"');
      return res.status(401).send('Authentication required for queue dashboard');
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];

    if (username === env.BULL_BOARD_USERNAME && password === env.BULL_BOARD_PASSWORD) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Queue Monitor"');
    return res.status(401).send('Invalid queue dashboard credentials');
  };

  return {
    router: serverAdapter.getRouter(),
    basicAuthMiddleware,
  };
}
