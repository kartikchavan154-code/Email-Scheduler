import { prisma } from '../../config/prisma';
import { emailQueue } from '../queue/email.queue';
import { logger } from '../../config/logger';

export class ReconciliationService {
  /**
   * One-time startup reconciliation:
   * 1. Recovers stale 'PROCESSING' records left by an unexpected worker crash
   * 2. Inspects all 'SCHEDULED' database records
   * 3. Re-enqueues only records that have no active or delayed BullMQ job
   */
  static async reconcileOnStartup(): Promise<{
    inspected: number;
    staleRecovered: number;
    reEnqueued: number;
    alreadyActiveOrCompleted: number;
  }> {
    logger.info('🔄 Starting one-time persistent startup reconciliation...');

    // 1. Recover stale PROCESSING records (e.g., worker died mid-flight > 5 mins ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const staleResult = await prisma.email.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: fiveMinutesAgo },
      },
      data: {
        status: 'SCHEDULED',
        errorMessage: 'Recovered from unexpected worker termination during startup reconciliation',
      },
    });

    const staleRecovered = staleResult.count;
    if (staleRecovered > 0) {
      logger.warn({ staleRecovered }, 'Recovered stale processing email records to SCHEDULED');
    }

    // 2. Fetch all SCHEDULED emails
    const scheduledEmails = await prisma.email.findMany({
      where: {
        status: 'SCHEDULED',
      },
      select: {
        id: true,
        userId: true,
        senderId: true,
        batchId: true,
        recipientEmail: true,
        subject: true,
        body: true,
        scheduledAt: true,
        bullmqJobId: true,
      },
    });

    let reEnqueued = 0;
    let alreadyActiveOrCompleted = 0;

    for (const email of scheduledEmails) {
      const jobId = email.bullmqJobId || `email_${email.id}`;

      try {
        const existingJob = await emailQueue.getJob(jobId);

        if (existingJob) {
          const state = await existingJob.getState();
          // If job is waiting, active, or delayed, leave it untouched
          if (['waiting', 'delayed', 'active'].includes(state)) {
            alreadyActiveOrCompleted++;
            continue;
          }

          // If job was already marked completed in queue, update DB if necessary
          if (state === 'completed') {
            await prisma.email.update({
              where: { id: email.id },
              data: { status: 'SENT', sentAt: new Date() },
            });
            alreadyActiveOrCompleted++;
            continue;
          }
        }

        // Job does not exist in BullMQ! Safely re-enqueue
        const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
        await emailQueue.add(
          'send-email',
          {
            emailId: email.id,
            userId: email.userId,
            senderId: email.senderId,
            batchId: email.batchId,
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            attemptNumber: 1,
          },
          {
            jobId,
            delay,
          }
        );
        reEnqueued++;
      } catch (err: any) {
        logger.error({ err: err.message, emailId: email.id }, 'Error during email reconciliation');
      }
    }

    logger.info(
      {
        inspected: scheduledEmails.length,
        staleRecovered,
        reEnqueued,
        alreadyActiveOrCompleted,
      },
      '✅ Startup reconciliation completed successfully'
    );

    return {
      inspected: scheduledEmails.length,
      staleRecovered,
      reEnqueued,
      alreadyActiveOrCompleted,
    };
  }
}
