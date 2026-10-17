import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export class SmtpService {
  private static transporters: Map<string, Transporter> = new Map();

  /**
   * Retrieves or creates a cached Nodemailer transporter for a given sender
   */
  static async getTransporter(senderId: string): Promise<Transporter> {
    if (this.transporters.has(senderId)) {
      return this.transporters.get(senderId)!;
    }

    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      throw new Error(`Sender not found for ID: ${senderId}`);
    }

    let host = sender.smtpHost || env.ETHEREAL_HOST;
    let port = sender.smtpPort || env.ETHEREAL_PORT;
    let user = sender.smtpUser || env.ETHEREAL_USER;
    let pass = sender.smtpPass || env.ETHEREAL_PASS;

    // If credentials are completely empty, create an on-demand Ethereal account
    if (!user || !pass) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        host = testAccount.smtp.host;
        port = testAccount.smtp.port;
        user = testAccount.user;
        pass = testAccount.pass;

        // Update sender record
        await prisma.sender.update({
          where: { id: senderId },
          data: {
            smtpHost: host,
            smtpPort: port,
            smtpUser: user,
            smtpPass: pass,
          },
        });
        logger.info({ senderId, user }, 'Created on-demand Ethereal test account for sender');
      } catch (err: any) {
        logger.error({ err: err.message }, 'Failed to create test Ethereal account, falling back to mock');
      }
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    this.transporters.set(senderId, transporter);
    return transporter;
  }

  /**
   * Verify SMTP connection for sender
   */
  static async verifyConnection(senderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter(senderId);
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      logger.warn({ err: err.message, senderId }, 'SMTP transporter verification failed');
      return { success: false, error: err.message };
    }
  }

  /**
   * Send email and extract Ethereal preview URL
   */
  static async sendMail(options: {
    senderId: string;
    fromName: string;
    fromEmail: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<SendEmailResult> {
    const transporter = await this.getTransporter(options.senderId);

    const mailOptions = {
      from: `"${options.fromName}" <${options.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.body.replace(/\n/g, '<br />'),
      text: options.body,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || false,
    };
  }

  /**
   * Categorize error into transient (retryable) vs permanent
   */
  static isTransientError(error: any): boolean {
    const code = error.code || '';
    const message = (error.message || '').toLowerCase();

    // Connection errors, timeouts, 4xx SMTP responses
    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'EAI_AGAIN' ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('try again later') ||
      message.includes('421') ||
      message.includes('450') ||
      message.includes('451') ||
      message.includes('452')
    ) {
      return true;
    }

    return false;
  }
}
