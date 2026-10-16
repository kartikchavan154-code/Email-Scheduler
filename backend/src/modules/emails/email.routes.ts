import { Router, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { SchedulingService } from '../scheduling/scheduling.service';
import { RecipientParser } from '../../utils/csv-parser';
import { ElasticsearchService } from '../search/elasticsearch.service';
import { logger } from '../../config/logger';

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  storage: multer.memoryStorage(),
});

const router = Router();

// Protect all email routes
router.use(requireAuth);

/**
 * POST /api/emails/schedule
 * Schedules emails from JSON recipients or uploaded CSV/TXT lead file
 */
router.post('/schedule', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body;

    const schema = z.object({
      senderId: z.string().min(1, 'Sender is required'),
      subject: z.string().min(1, 'Subject is required'),
      body: z.string().min(1, 'Email body is required'),
      startTime: z.string().optional(),
      delayBetweenEmailsSeconds: z.coerce.number().min(1).default(2),
      hourlyLimit: z.coerce.number().min(1).optional(),
      recipients: z.union([z.string(), z.array(z.string())]).optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
      });
    }

    let rawRecipientList: string[] = [];

    // Check if file was uploaded
    if (req.file) {
      const fileParseResult = RecipientParser.parse(req.file.buffer);
      rawRecipientList = fileParseResult.valid;

      if (rawRecipientList.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_VALID_RECIPIENTS',
            message: 'No valid recipient email addresses found in uploaded file.',
            details: fileParseResult,
          },
        });
      }
    } else if (parsed.data.recipients) {
      let recipientInput = parsed.data.recipients;
      if (typeof recipientInput === 'string') {
        const parseRes = RecipientParser.parse(recipientInput);
        rawRecipientList = parseRes.valid;
      } else {
        const joined = recipientInput.join('\n');
        const parseRes = RecipientParser.parse(joined);
        rawRecipientList = parseRes.valid;
      }
    }

    if (rawRecipientList.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_RECIPIENTS',
          message: 'Please provide recipient emails either as a list or via CSV/text file upload.',
        },
      });
    }

    const startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : new Date();

    const result = await SchedulingService.scheduleBatch({
      userId,
      senderId: parsed.data.senderId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      recipients: rawRecipientList,
      startTime,
      delayBetweenEmailsSeconds: parsed.data.delayBetweenEmailsSeconds,
      hourlyLimit: parsed.data.hourlyLimit,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to schedule emails');
    res.status(500).json({
      success: false,
      error: { code: 'SCHEDULE_FAILED', message: err.message },
    });
  }
});

/**
 * GET /api/emails/stats
 * Overview counts for scheduled, sent, and failed emails
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [scheduled, sent, failed, cancelled, activeSenders] = await Promise.all([
      prisma.email.count({ where: { userId, status: 'SCHEDULED' } }),
      prisma.email.count({ where: { userId, status: 'SENT' } }),
      prisma.email.count({ where: { userId, status: 'FAILED' } }),
      prisma.email.count({ where: { userId, status: 'CANCELLED' } }),
      prisma.sender.count({ where: { userId, enabled: true } }),
    ]);

    res.json({
      success: true,
      data: {
        scheduled,
        sent,
        failed,
        cancelled,
        total: scheduled + sent + failed + cancelled,
        activeSenders,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'STATS_FAILED', message: err.message },
    });
  }
});

/**
 * GET /api/emails/scheduled
 * Paginated list of scheduled emails
 */
router.get('/scheduled', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: { userId, status: 'SCHEDULED' },
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where: { userId, status: 'SCHEDULED' } }),
    ]);

    res.json({
      success: true,
      data: { emails, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/emails/sent
 * Paginated list of successfully sent emails
 */
router.get('/sent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: { userId, status: 'SENT' },
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where: { userId, status: 'SENT' } }),
    ]);

    res.json({
      success: true,
      data: { emails, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/emails/failed
 * Paginated list of failed emails
 */
router.get('/failed', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: { userId, status: 'FAILED' },
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where: { userId, status: 'FAILED' } }),
    ]);

    res.json({
      success: true,
      data: { emails, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/emails/search
 * Elasticsearch search for scheduled, sent, and failed emails
 */
router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { q, status, senderId, from, to, page, limit } = req.query;

    const result = await ElasticsearchService.searchEmails(userId, {
      q: q ? String(q) : undefined,
      status: status ? String(status) : undefined,
      senderId: senderId ? String(senderId) : undefined,
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    });

    res.json({
      success: true,
      data: {
        emails: result.emails,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err: any) {
    // If Elasticsearch had an issue, fallback smoothly to Prisma search
    logger.warn({ err: err.message }, 'Falling back to Postgres search');
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (req.query.status) {
      where.status = String(req.query.status).toUpperCase();
    }
    if (req.query.q) {
      const qStr = String(req.query.q);
      where.OR = [
        { recipientEmail: { contains: qStr, mode: 'insensitive' } },
        { subject: { contains: qStr, mode: 'insensitive' } },
        { body: { contains: qStr, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        emails,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
});

/**
 * GET /api/emails/:id
 * Single email detail
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = await prisma.email.findFirst({
      where: { id: req.params.id, userId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        batch: true,
      },
    });

    if (!email) {
      return res.status(404).json({ success: false, error: { message: 'Email not found' } });
    }

    res.json({ success: true, data: email });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/emails/:id/cancel
 * Cancel a scheduled email
 */
router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const updated = await SchedulingService.cancelScheduledEmail(userId, req.params.id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

export const emailRouter = router;
