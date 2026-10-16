import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { AuthUser } from '../../types';

export class AuthService {
  /**
   * Generates Google OAuth 2.0 authorization URL
   */
  static getGoogleAuthUrl(state: string): string {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      client_id: env.GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      state,
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Exchange Google authorization code for access token and fetch user profile
   */
  static async handleGoogleCallback(code: string): Promise<AuthUser> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    };

    const res = await axios.post(tokenUrl, new URLSearchParams(values), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_type, id_token, access_token } = res.data;

    // Fetch user info from Google
    const userinfoRes = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token || access_token}`,
        },
      }
    );

    const googleUser = userinfoRes.data;

    // Upsert user in PostgreSQL
    const user = await prisma.user.upsert({
      where: { email: googleUser.email },
      update: {
        name: googleUser.name || googleUser.email.split('@')[0],
        avatarUrl: googleUser.picture,
        googleId: googleUser.sub,
      },
      create: {
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatarUrl: googleUser.picture,
        googleId: googleUser.sub,
      },
    });

    // Auto-create default Ethereal sender if none exists
    await this.ensureDefaultSender(user.id, user.email, user.name);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      googleId: user.googleId,
    };
  }

  /**
   * Generates a signed JWT session token
   */
  static generateSessionToken(user: { id: string; email: string; name: string }): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      env.SESSION_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Developer / Test Login (ensures continuous development even before Google credentials are set)
   */
  static async devOrTestLogin(email = 'demo@reachinbox.test', name = 'ReachInbox Demo User'): Promise<{ token: string; user: AuthUser }> {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
        googleId: `dev_${crypto.randomBytes(6).toString('hex')}`,
      },
    });

    await this.ensureDefaultSender(user.id, user.email, user.name);

    const token = this.generateSessionToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        googleId: user.googleId,
      },
    };
  }

  /**
   * Ensure user has at least one Ethereal test sender account
   */
  static async ensureDefaultSender(userId: string, userEmail: string, userName: string) {
    try {
      const existingSender = await prisma.sender.findFirst({
        where: { userId },
      });

      if (!existingSender) {
        let testAccount: any;
        if (!env.ETHEREAL_USER || !env.ETHEREAL_PASS) {
          try {
            testAccount = await nodemailer.createTestAccount();
          } catch (e: any) {
            logger.warn({ err: e.message }, 'Could not create dynamic Ethereal account, using defaults');
          }
        }

        await prisma.sender.create({
          data: {
            userId,
            name: `${userName} (Primary)`,
            email: testAccount?.user || env.ETHEREAL_USER || `sender@${userEmail.split('@')[1] || 'ethereal.email'}`,
            smtpHost: testAccount?.smtp?.host || env.ETHEREAL_HOST || 'smtp.ethereal.email',
            smtpPort: testAccount?.smtp?.port || env.ETHEREAL_PORT || 587,
            smtpUser: testAccount?.user || env.ETHEREAL_USER || 'ethereal_user',
            smtpPass: testAccount?.pass || env.ETHEREAL_PASS || 'ethereal_pass',
            hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
            enabled: true,
          },
        });
        logger.info({ userId }, 'Created default sender account for user');
      }
    } catch (err: any) {
      logger.error({ err: err.message, userId }, 'Failed to ensure default sender');
    }
  }
}
