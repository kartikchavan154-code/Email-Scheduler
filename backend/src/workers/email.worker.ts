import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../modules/queue/email.queue';
import { getRedisOptions } from '../config/redis';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { RateLimiterService } from '../modules/scheduling/rate-limiter.service';
import { SmtpService } from '../modules/senders/smtp.service';
import { SlackService } from '../modules/slack/slack.service';
import { ElasticsearchService } from '../modules/search/elasticsearch.service';
import { EmailJobData } from '../types';

export class EmailWorker {
  private worker: Worker<EmailJobData> | null = null;

  start(): Worker<EmailJobData> {
    if (this.worker) return this.worker;

    logger.info(
      {
        concurrency: env.WORKER_CONCURRENCY,
        minDelayMs: env.MIN_DELAY_BETWEEN_SENDS_MS,
        maxPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      },
      'Starting BullMQ Email Worker...'
    );

    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        return this.processJob(job);
      },
      {
        connection: {
          host: new URL(env.REDIS_URL).hostname,
          port: Number(new URL(env.REDIS_URL).port || 6379),
          password: new URL(env.REDIS_URL).password || undefined,
          ...getRedisOptions(),
        },
        concurrency: env.WORKER_CONCURRENCY,
        limiter: {
          max: 1000,
          duration: 1000,
        },
      }
    );

    this.worker.on('ready', () => {
      logger.info('Email Worker is online and waiting for jobs');
    });

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, emailId: job.data.emailId }, 'Email job completed successfully');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, 'Email job failed');
    });

    this.worker.on('error', (err) => {
      logger.error({ error: err.message }, 'Email worker internal error');
    });

    return this.worker;
  }

  private async processJob(job: Job<EmailJobData>): Promise<any> {
    const { emailId, senderId, userId } = job.data;

    // 1. Check current database state
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: {
        sender: true,
      },
    });

    if (!email) {
      logger.warn({ emailId }, 'Email record not found in database, skipping job');
      return { skipped: true, reason: 'RECORD_NOT_FOUND' };
    }

    if (email.status === 'CANCELLED') {
      logger.info({ emailId }, 'Email was cancelled by user, skipping send');
      return { skipped: true, reason: 'CANCELLED' };
    }

    if (email.status === 'SENT') {
      logger.info({ emailId }, 'Email already marked as SENT (idempotent safeguard)');
      return { skipped: true, reason: 'ALREADY_SENT' };
    }

    const sender = email.sender;
    if (!sender || !sender.enabled) {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          errorMessage: 'Assigned sender not found or disabled',
        },
      });
      await ElasticsearchService.updateEmailStatus(emailId, {
        status: 'FAILED',
        errorMessage: 'Assigned sender not found or disabled',
      });
      return { failed: true, reason: 'SENDER_DISABLED' };
    }

    // Mark email as PROCESSING in DB
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'PROCESSING' },
    });

    // 2. Concurrency-Safe Distributed Rate Limiting & Inter-Send Delay Check
    const rateCheck = await RateLimiterService.reserveSendSlot(
      senderId,
      sender.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      env.MIN_DELAY_BETWEEN_SENDS_MS
    );

    // Case A: Minimum inter-send delay violated
    if (rateCheck.status === 'MIN_DELAY_VIOLATION') {
      const delayMs = rateCheck.delayMs || env.MIN_DELAY_BETWEEN_SENDS_MS;
      logger.debug(
        { emailId, senderId, delayMs },
        'Sender minimum delay enforcement: rescheduling job'
      );

      // Reset to SCHEDULED in DB
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'SCHEDULED' },
      });

      // Move job to delayed without blocking worker thread
      await job.moveToDelayed(Date.now() + delayMs, job.token);
      return { deferred: true, reason: 'MIN_DELAY_THROTTLE', delayMs };
    }

    // Case B: Hourly Rate Limit Exceeded
    if (rateCheck.status === 'RATE_LIMITED') {
      const nextTime = rateCheck.nextEligibleTimeMs || Date.now() + 3600000;
      logger.warn(
        { emailId, senderId, currentCount: rateCheck.currentCount, nextTime: new Date(nextTime).toISOString() },
        'Sender hourly rate limit hit: deferring email to next hourly window'
      );

      // Send Slack Alert if this is the first transition in this window
      if (rateCheck.isFirstRateLimitHit) {
        SlackService.sendRateLimitNotification({
          userId,
          senderName: sender.name,
          senderEmail: sender.email,
          hourlyLimit: sender.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          currentCount: rateCheck.currentCount,
          windowKey: rateCheck.windowKey,
          nextEligibleTimeMs: nextTime,
        }).catch((e) => {
          logger.error({ err: e.message }, 'Background Slack notification dispatch failed');
        });
      }

      // Update email scheduledAt in DB and reset to SCHEDULED
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SCHEDULED',
          scheduledAt: new Date(nextTime),
          errorMessage: `Rescheduled: Sender reached hourly limit (${rateCheck.currentCount}/${sender.hourlyLimit}).`,
        },
      });

      await ElasticsearchService.updateEmailStatus(emailId, {
        status: 'SCHEDULED',
        errorMessage: `Rescheduled: Sender reached hourly limit.`,
      });

      // Reschedule job in BullMQ for next available hourly window
      await job.moveToDelayed(nextTime, job.token);
      return { deferred: true, reason: 'RATE_LIMIT_DEFERRED', nextEligibleTime: nextTime };
    }

    // Case C: Allowed! Capacity reserved. Proceed to SMTP send
    try {
      const result = await SmtpService.sendMail({
        senderId,
        fromName: sender.name,
        fromEmail: sender.email,
        to: email.recipientEmail,
        subject: email.subject,
        body: email.body,
      });

      const sentAt = new Date();
      const previewUrl = result.previewUrl ? result.previewUrl : null;

      // Update Database
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt,
          etherealPreviewUrl: previewUrl,
          errorMessage: null,
        },
      });

      // Update Elasticsearch
      await ElasticsearchService.updateEmailStatus(emailId, {
        status: 'SENT',
        sentAt,
        etherealPreviewUrl: previewUrl,
        errorMessage: null,
      });

      logger.info(
        {
          emailId,
          recipient: email.recipientEmail,
          sender: sender.email,
          previewUrl,
        },
        '✅ Email delivered successfully via SMTP'
      );

      return {
        success: true,
        messageId: result.messageId,
        previewUrl,
      };
    } catch (err: any) {
      logger.error({ err: err.message, emailId }, 'SMTP send failed');

      // Release reserved rate limit slot on transient error
      await RateLimiterService.releaseReservation(senderId);

      const isTransient = SmtpService.isTransientError(err);
      const retryCount = (email.retryCount || 0) + 1;

      if (isTransient && retryCount < 5) {
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SCHEDULED',
            retryCount,
            errorMessage: `Transient failure: ${err.message}. Retrying...`,
          },
        });
        throw err; // triggers BullMQ exponential backoff retry
      } else {
        // Permanent failure
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            retryCount,
            errorMessage: `Permanent failure: ${err.message}`,
          },
        });

        await ElasticsearchService.updateEmailStatus(emailId, {
          status: 'FAILED',
          errorMessage: err.message,
          retryCount,
        });

        return { failed: true, error: err.message };
      }
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Email Worker stopped gracefully');
    }
  }
}

export const emailWorker = new EmailWorker();
