import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { RateLimiterService } from '../scheduling/rate-limiter.service';
import { SmtpService } from './smtp.service';
import { env } from '../../config/env';
import nodemailer from 'nodemailer';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/senders
 * List all senders for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const senders = await prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        email: true,
        smtpHost: true,
        smtpPort: true,
        hourlyLimit: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: senders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/senders
 * Create a new sender identity (either with provided SMTP or automatic Ethereal account)
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const schema = z.object({
      name: z.string().min(1, 'Sender name is required'),
      email: z.string().email('Valid email address required'),
      smtpHost: z.string().optional(),
      smtpPort: z.coerce.number().optional(),
      smtpUser: z.string().optional(),
      smtpPass: z.string().optional(),
      hourlyLimit: z.coerce.number().min(1).max(env.MAX_EMAILS_PER_HOUR_PER_SENDER).default(200),
      isEthereal: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
      });
    }

    let { name, email, smtpHost, smtpPort, smtpUser, smtpPass, hourlyLimit, isEthereal } = parsed.data;

    if (isEthereal || (!smtpHost && !smtpUser)) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        smtpHost = testAccount.smtp.host;
        smtpPort = testAccount.smtp.port;
        smtpUser = testAccount.user;
        smtpPass = testAccount.pass;
        email = testAccount.user;
      } catch (e: any) {
        smtpHost = env.ETHEREAL_HOST;
        smtpPort = env.ETHEREAL_PORT;
        smtpUser = env.ETHEREAL_USER || 'ethereal_user';
        smtpPass = env.ETHEREAL_PASS || 'ethereal_pass';
      }
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        name,
        email,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        hourlyLimit,
        enabled: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: sender.id,
        name: sender.name,
        email: sender.email,
        hourlyLimit: sender.hourlyLimit,
        enabled: sender.enabled,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * PATCH /api/senders/:id
 * Update sender configuration
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const schema = z.object({
      name: z.string().optional(),
      hourlyLimit: z.coerce.number().min(1).max(env.MAX_EMAILS_PER_HOUR_PER_SENDER).optional(),
      enabled: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.format() });
    }

    const sender = await prisma.sender.updateMany({
      where: { id, userId },
      data: parsed.data,
    });

    if (sender.count === 0) {
      return res.status(404).json({ success: false, error: { message: 'Sender not found' } });
    }

    res.json({ success: true, message: 'Sender updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/senders/:id/limits
 * Inspect live distributed rate limit window and remaining capacity
 */
router.get('/:id/limits', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const sender = await prisma.sender.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!sender) {
      return res.status(404).json({ success: false, error: { message: 'Sender not found' } });
    }

    const status = await RateLimiterService.getSenderHourlyStatus(sender.id, sender.hourlyLimit);

    res.json({
      success: true,
      data: {
        senderId: sender.id,
        senderName: sender.name,
        senderEmail: sender.email,
        ...status,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/senders/:id/verify
 * Verify SMTP connection
 */
router.post('/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const sender = await prisma.sender.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!sender) {
      return res.status(404).json({ success: false, error: { message: 'Sender not found' } });
    }

    const verification = await SmtpService.verifyConnection(sender.id);
    res.json({ success: verification.success, data: verification });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export const senderRouter = router;
