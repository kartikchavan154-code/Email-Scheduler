import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { SlackService } from './slack.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const router = Router();

/**
 * GET /api/slack/connect
 * Initiate Slack OAuth v2 authorization flow
 */
router.get('/connect', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  // Embed user ID and random token in signed/hex state
  const state = Buffer.from(JSON.stringify({ userId, rand: crypto.randomBytes(8).toString('hex') })).toString('base64');

  res.cookie('slack_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const url = SlackService.getSlackAuthUrl(state);
  res.redirect(url);
});

/**
 * GET /api/slack/callback
 * Slack OAuth callback
 */
router.get('/callback', async (req: AuthenticatedRequest, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error({ error }, 'Slack OAuth callback returned error');
    return res.redirect(`${env.FRONTEND_URL}/settings?error=slack_${encodeURIComponent(String(error))}`);
  }

  const storedState = req.cookies?.slack_oauth_state;
  if (!state || !storedState || state !== storedState) {
    return res.redirect(`${env.FRONTEND_URL}/settings?error=slack_state_mismatch`);
  }

  res.clearCookie('slack_oauth_state');

  try {
    const parsedState = JSON.parse(Buffer.from(String(state), 'base64').toString('utf8'));
    const userId = parsedState.userId;

    if (!userId) {
      throw new Error('User ID missing from OAuth state');
    }

    await SlackService.handleSlackCallback(userId, String(code));
    res.redirect(`${env.FRONTEND_URL}/settings?slack=connected`);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to process Slack OAuth callback');
    res.redirect(`${env.FRONTEND_URL}/settings?error=slack_connection_failed`);
  }
});

/**
 * GET /api/slack/status
 * Get Slack connection status
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await SlackService.getStatus(userId);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/slack/disconnect
 * Disconnect Slack
 */
router.post('/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await SlackService.disconnect(userId);
    res.json({ success: true, message: 'Slack disconnected' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/slack/test-message
 * Send a verification test rate limit alert
 */
router.post('/test-message', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const success = await SlackService.sendRateLimitNotification({
      userId,
      senderName: 'ReachInbox Test Sender',
      senderEmail: 'test-sender@reachinbox.test',
      hourlyLimit: 200,
      currentCount: 200,
      windowKey: new Date().toISOString().substring(0, 13),
      nextEligibleTimeMs: Date.now() + 3600000,
    });

    res.json({
      success,
      message: success ? 'Test alert sent to Slack successfully!' : 'Could not send test message. Check Slack connection.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export const slackRouter = router;
