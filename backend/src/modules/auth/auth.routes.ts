import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from './auth.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const router = Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth 2.0 flow
 */
router.get('/google', (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const url = AuthService.getGoogleAuthUrl(state);
  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Google OAuth 2.0 callback
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error({ error }, 'Google OAuth returned error');
    return res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(String(error))}`);
  }

  const storedState = req.cookies?.oauth_state;
  if (!state || !storedState || state !== storedState) {
    logger.warn('State mismatch in Google OAuth callback (potential CSRF)');
    return res.redirect(`${env.FRONTEND_URL}/login?error=state_mismatch`);
  }

  res.clearCookie('oauth_state');

  try {
    const user = await AuthService.handleGoogleCallback(String(code));
    const token = AuthService.generateSessionToken(user);

    // Set secure HTTP-only cookie
    res.cookie('reachinbox_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to handle Google OAuth callback');
    res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user details
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Sign out and clear session cookie
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('reachinbox_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * POST /api/auth/dev-login
 * Developer & test quick login (especially useful for running automated tests or instant local demo)
 */
router.post('/dev-login', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    const { token, user } = await AuthService.devOrTestLogin(email, name);

    res.cookie('reachinbox_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DEV_LOGIN_FAILED', message: err.message },
    });
  }
});

export const authRouter = router;
