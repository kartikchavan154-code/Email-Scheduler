import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { emailQueue } from '../queue/email.queue';
import { ElasticsearchService } from '../search/elasticsearch.service';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

export interface ScheduleBatchInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
}

export class SchedulingService {
  /**
   * Schedule a batch of emails using persistent BullMQ delayed jobs
   */
  static async scheduleBatch(input: ScheduleBatchInput) {
    const {
      userId,
      senderId,
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmailsSeconds = 2,
    } = input;

    // Validate sender belongs to user and is enabled
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender not found or not authorized');
    }

    if (!sender.enabled) {
      throw new Error('Sender is currently disabled');
    }

    // Enforce effective hourly limit (cannot exceed system global maximum)
    const effectiveHourlyLimit = Math.min(
      input.hourlyLimit || sender.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      env.MAX_EMAILS_PER_HOUR_PER_SENDER
    );

    const now = new Date();
    const startTimestamp = startTime.getTime() < now.getTime() ? now.getTime() : startTime.getTime();
    const delayStepMs = Math.max(env.MIN_DELAY_BETWEEN_SENDS_MS, delayBetweenEmailsSeconds * 1000);

    // 1. Create EmailBatch in PostgreSQL
    const batch = await prisma.emailBatch.create({
      data: {
        userId,
        senderId,
        subject,
        body,
        startTime: new Date(startTimestamp),
        delayBetweenEmails: Math.round(delayStepMs / 1000),
        hourlyLimit: effectiveHourlyLimit,
        totalRecipients: recipients.length,
      },
    });

    // 2. Prepare Email records with calculated scheduledAt(i) = T + i * D
    const emailRecordsData = recipients.map((recipientEmail, index) => {
      const emailId = crypto.randomUUID();
      const scheduledAtTime = new Date(startTimestamp + index * delayStepMs);
      const idempotencyKey = `batch_${batch.id}_rec_${index}_${crypto.createHash('md5').update(recipientEmail).digest('hex').substring(0, 8)}`;
      const bullmqJobId = `email_${emailId}`;

      return {
        id: emailId,
        userId,
        senderId,
        batchId: batch.id,
        recipientEmail,
        subject,
        body,
        scheduledAt: scheduledAtTime,
        status: 'SCHEDULED' as const,
        bullmqJobId,
        idempotencyKey,
        retryCount: 0,
      };
    });

    // Insert all emails into PostgreSQL
    // Chunk in batches of 500 for high efficiency
    const CHUNK_SIZE = 500;
    for (let i = 0; i < emailRecordsData.length; i += CHUNK_SIZE) {
      const chunk = emailRecordsData.slice(i, i + CHUNK_SIZE);
      await prisma.email.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    // 3. Prepare BullMQ delayed jobs
    const jobs = emailRecordsData.map((record) => {
      const delay = Math.max(0, record.scheduledAt.getTime() - Date.now());
      return {
        name: 'send-email',
        data: {
          emailId: record.id,
          userId: record.userId,
          senderId: record.senderId,
          batchId: record.batchId,
          recipientEmail: record.recipientEmail,
          subject: record.subject,
          body: record.body,
          attemptNumber: 1,
        },
        opts: {
          jobId: record.bullmqJobId, // Stable, deterministic BullMQ job ID
          delay,
        },
      };
    });

    // Enqueue jobs in BullMQ
    for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
      const jobChunk = jobs.slice(i, i + CHUNK_SIZE);
      await emailQueue.addBulk(jobChunk);
    }

    logger.info(
      { batchId: batch.id, totalRecipients: recipients.length, senderId },
      'Successfully created email batch and enqueued BullMQ delayed jobs'
    );

    // 4. Index scheduled emails in Elasticsearch asynchronously
    Promise.allSettled(
      emailRecordsData.map((record) =>
        ElasticsearchService.indexEmail({
          id: record.id,
          userId: record.userId,
          senderId: record.senderId,
          senderName: sender.name,
          senderEmail: sender.email,
          recipientEmail: record.recipientEmail,
          subject: record.subject,
          body: record.body,
          status: 'SCHEDULED',
          batchId: record.batchId,
          scheduledAt: record.scheduledAt,
        })
      )
    ).catch((err) => {
      logger.warn({ err: err.message }, 'Background indexing in Elasticsearch encountered non-fatal issues');
    });

    return {
      batchId: batch.id,
      totalRecipients: recipients.length,
      scheduledCount: emailRecordsData.length,
      startTime: batch.startTime,
      firstEmailScheduledAt: emailRecordsData[0]?.scheduledAt,
      lastEmailScheduledAt: emailRecordsData[emailRecordsData.length - 1]?.scheduledAt,
    };
  }

  /**
   * Cancel a scheduled email if not yet processed
   */
  static async cancelScheduledEmail(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId },
    });

    if (!email) {
      throw new Error('Email not found');
    }

    if (email.status !== 'SCHEDULED') {
      throw new Error(`Cannot cancel email with status: ${email.status}`);
    }

    // Remove job from BullMQ if present
    if (email.bullmqJobId) {
      try {
        const job = await emailQueue.getJob(email.bullmqJobId);
        if (job) {
          await job.remove();
        }
      } catch (err: any) {
        logger.warn({ err: err.message, jobId: email.bullmqJobId }, 'Could not remove BullMQ job on cancel');
      }
    }

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { status: 'CANCELLED' },
    });

    await ElasticsearchService.updateEmailStatus(emailId, { status: 'CANCELLED' });

    return updated;
  }
}
