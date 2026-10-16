import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/batches
 * List email batches
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      prisma.emailBatch.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailBatch.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: { batches, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/batches/:id
 * Get details and breakdown of a specific email batch
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const batch = await prisma.emailBatch.findFirst({
      where: { id: req.params.id, userId },
      include: {
        emails: {
          select: {
            id: true,
            recipientEmail: true,
            status: true,
            scheduledAt: true,
            sentAt: true,
            etherealPreviewUrl: true,
            errorMessage: true,
          },
          take: 100,
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: { message: 'Batch not found' } });
    }

    const counts = await prisma.email.groupBy({
      by: ['status'],
      where: { batchId: batch.id },
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    counts.forEach((c) => {
      statusCounts[c.status] = c._count;
    });

    res.json({
      success: true,
      data: {
        batch,
        statusCounts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export const batchRouter = router;
