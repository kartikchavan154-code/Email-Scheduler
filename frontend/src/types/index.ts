export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  googleId?: string | null;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  smtpHost?: string;
  smtpPort?: number;
  hourlyLimit: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SenderLimitStatus {
  senderId: string;
  senderName: string;
  senderEmail: string;
  currentCount: number;
  remaining: number;
  limit: number;
  windowKey: string;
  windowEndMs: number;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Email {
  id: string;
  userId: string;
  senderId: string;
  batchId?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  bullmqJobId?: string | null;
  retryCount: number;
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface EmailBatch {
  id: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  totalRecipients: number;
  createdAt: string;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  cancelled: number;
  total: number;
  activeSenders: number;
}

export interface SlackStatus {
  connected: boolean;
  workspaceId?: string;
  workspaceName?: string;
  channelId?: string | null;
}
