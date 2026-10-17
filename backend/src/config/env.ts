import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:5000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  ELASTICSEARCH_NODE: z.string().url().default('http://localhost:9200'),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters or 64 hex characters'),

  GOOGLE_CLIENT_ID: z.string().default('google_client_id_placeholder'),
  GOOGLE_CLIENT_SECRET: z.string().default('google_client_secret_placeholder'),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  SLACK_CLIENT_ID: z.string().default('slack_client_id_placeholder'),
  SLACK_CLIENT_SECRET: z.string().default('slack_client_secret_placeholder'),
  SLACK_CALLBACK_URL: z.string().default('http://localhost:5000/api/slack/callback'),
  SLACK_NOTIFICATIONS_ENABLED: z.coerce.boolean().default(true),

  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),

  WORKER_CONCURRENCY: z.coerce.number().min(1).max(50).default(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().min(100).default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().min(1).default(200),
  RATE_LIMIT_TIMEZONE: z.string().default('UTC'),

  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default('admin'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Environment variable validation failed:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
