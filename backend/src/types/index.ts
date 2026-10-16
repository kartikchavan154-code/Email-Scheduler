export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  googleId?: string | null;
}

export interface EmailJobData {
  emailId: string;
  userId: string;
  senderId: string;
  batchId?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  attemptNumber?: number;
}

export interface RecipientEntry {
  email: string;
  isValid: boolean;
  error?: string;
}

export interface ParseRecipientsResult {
  valid: string[];
  invalid: { email: string; reason: string }[];
  duplicates: string[];
  total: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  currentCount: number;
  limit: number;
  windowResetTimeMs: number;
  nextAvailableTimeMs?: number;
}

export interface SearchQueryFilters {
  q?: string;
  status?: string;
  senderId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  page?: number;
  limit?: number;
}
