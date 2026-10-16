import axios from 'axios';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { encryptText, decryptText } from '../../utils/crypto';

export class SlackService {
  /**
   * Generates Slack OAuth v2 authorization URL
   */
  static getSlackAuthUrl(state: string): string {
    const rootUrl = 'https://slack.com/oauth/v2/authorize';
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: 'chat:write,chat:write.public,incoming-webhook',
      redirect_uri: env.SLACK_CALLBACK_URL,
      state,
    });
    return `${rootUrl}?${params.toString()}`;
  }

  /**
   * Handles Slack OAuth callback and stores encrypted bot token
   */
  static async handleSlackCallback(userId: string, code: string): Promise<any> {
    const tokenUrl = 'https://slack.com/api/oauth.v2.access';
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_CALLBACK_URL,
    });

    const response = await axios.post(tokenUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = response.data;
    if (!data.ok) {
      throw new Error(data.error || 'Slack OAuth token exchange failed');
    }

    const botToken = data.access_token;
    const workspaceId = data.team?.id || 'unknown_team';
    const workspaceName = data.team?.name || 'Slack Workspace';
    const incomingWebhookChannel = data.incoming_webhook?.channel_id || data.incoming_webhook?.channel;

    const encryptedToken = encryptText(botToken);

    // Save or update SlackConnection in PostgreSQL
    const connection = await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        slackWorkspaceId: workspaceId,
        slackWorkspaceName: workspaceName,
        channelId: incomingWebhookChannel || null,
        encryptedOAuthToken: encryptedToken,
        enabled: true,
      },
      create: {
        userId,
        slackWorkspaceId: workspaceId,
        slackWorkspaceName: workspaceName,
        channelId: incomingWebhookChannel || null,
        encryptedOAuthToken: encryptedToken,
        enabled: true,
      },
    });

    logger.info({ userId, workspaceId, workspaceName }, 'Slack workspace connected successfully');
    return connection;
  }

  /**
   * Disconnect Slack for a user
   */
  static async disconnect(userId: string): Promise<void> {
    await prisma.slackConnection.deleteMany({
      where: { userId },
    });
    logger.info({ userId }, 'Slack connection removed');
  }

  /**
   * Get current Slack connection status
   */
  static async getStatus(userId: string): Promise<{
    connected: boolean;
    workspaceId?: string;
    workspaceName?: string;
    channelId?: string | null;
  }> {
    const conn = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!conn || !conn.enabled) {
      return { connected: false };
    }

    return {
      connected: true,
      workspaceId: conn.slackWorkspaceId,
      workspaceName: conn.slackWorkspaceName || 'Connected Workspace',
      channelId: conn.channelId,
    };
  }

  /**
   * Send Rate Limit Alert to connected Slack workspace using Block Kit
   */
  static async sendRateLimitNotification(params: {
    userId: string;
    senderName: string;
    senderEmail: string;
    hourlyLimit: number;
    currentCount: number;
    windowKey: string;
    nextEligibleTimeMs: number;
    queuedCount?: number;
  }): Promise<boolean> {
    if (!env.SLACK_NOTIFICATIONS_ENABLED) {
      return false;
    }

    try {
      const conn = await prisma.slackConnection.findUnique({
        where: { userId: params.userId },
      });

      if (!conn || !conn.enabled) {
        return false;
      }

      const botToken = decryptText(conn.encryptedOAuthToken);
      const nextTimeFormatted = new Date(params.nextEligibleTimeMs).toUTCString();

      // Slack Block Kit message payload
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 ReachInbox Alert: Sender Hourly Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender *${params.senderName}* (\`${params.senderEmail}\`) has reached its configured hourly quota and has entered rate-limited state.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${params.hourlyLimit} emails/hr`,
            },
            {
              type: 'mrkdwn',
              text: `*Current Window:*\n\`${params.windowKey}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nThrottled & Auto-Rescheduled`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Eligible Window:*\n${nextTimeFormatted}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🛡️ *ReachInbox Resilient Dispatcher:* Remaining emails are safely queued and will automatically resume at the start of the next window.',
            },
          ],
        },
      ];

      // Send via Slack chat.postMessage
      // If a specific channelId is available use it, else default to 'general' or webhook
      const channel = conn.channelId || 'general';

      const slackResponse = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel,
          text: `🚨 Sender ${params.senderEmail} reached its hourly rate limit (${params.hourlyLimit}/hr). Remaining emails rescheduled for next window.`,
          blocks,
        },
        {
          headers: {
            Authorization: `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!slackResponse.data.ok) {
        logger.warn(
          { error: slackResponse.data.error, userId: params.userId },
          'Slack API returned non-OK status on chat.postMessage'
        );
        return false;
      }

      logger.info(
        { userId: params.userId, senderEmail: params.senderEmail },
        'Slack rate limit alert delivered successfully'
      );
      return true;
    } catch (err: any) {
      logger.error({ err: err.message, userId: params.userId }, 'Failed to send Slack rate limit alert');
      return false;
    }
  }
}
