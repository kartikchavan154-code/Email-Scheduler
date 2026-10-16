import { Client } from '@elastic/elasticsearch';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export const EMAILS_INDEX_NAME = 'reachinbox_emails';

export class ElasticsearchService {
  private static client: Client | null = null;
  private static isConnected = false;

  static getClient(): Client {
    if (!this.client) {
      this.client = new Client({
        node: env.ELASTICSEARCH_NODE,
        maxRetries: 3,
        requestTimeout: 10000,
      });
    }
    return this.client;
  }

  /**
   * Initialize index with explicit mappings
   */
  static async initializeIndex(): Promise<void> {
    const client = this.getClient();
    try {
      const exists = await client.indices.exists({ index: EMAILS_INDEX_NAME });
      if (!exists) {
        await client.indices.create({
          index: EMAILS_INDEX_NAME,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              senderName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              senderEmail: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              batchId: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              etherealPreviewUrl: { type: 'keyword', index: false },
              errorMessage: { type: 'text' },
              createdAt: { type: 'date' },
            },
          },
        });
        logger.info({ index: EMAILS_INDEX_NAME }, 'Created Elasticsearch email index with mappings');
      }
      this.isConnected = true;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Elasticsearch index initialization warning (will retry on operations)');
      this.isConnected = false;
    }
  }

  /**
   * Index or update an email document
   */
  static async indexEmail(email: {
    id: string;
    userId: string;
    senderId: string;
    senderName?: string;
    senderEmail?: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: string;
    batchId?: string | null;
    scheduledAt: Date;
    sentAt?: Date | null;
    etherealPreviewUrl?: string | null;
    errorMessage?: string | null;
    createdAt?: Date;
  }): Promise<void> {
    try {
      const client = this.getClient();
      await client.index({
        index: EMAILS_INDEX_NAME,
        id: email.id,
        document: {
          id: email.id,
          userId: email.userId,
          senderId: email.senderId,
          senderName: email.senderName || '',
          senderEmail: email.senderEmail || '',
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          body: email.body,
          status: email.status,
          batchId: email.batchId || null,
          scheduledAt: email.scheduledAt.toISOString(),
          sentAt: email.sentAt ? email.sentAt.toISOString() : null,
          etherealPreviewUrl: email.etherealPreviewUrl || null,
          errorMessage: email.errorMessage || null,
          createdAt: (email.createdAt || new Date()).toISOString(),
        },
      });
    } catch (err: any) {
      logger.error({ err: err.message, emailId: email.id }, 'Failed to index email document in Elasticsearch');
    }
  }

  /**
   * Update status of an indexed email document
   */
  static async updateEmailStatus(
    emailId: string,
    updates: {
      status: string;
      sentAt?: Date | null;
      errorMessage?: string | null;
      etherealPreviewUrl?: string | null;
      retryCount?: number;
    }
  ): Promise<void> {
    try {
      const client = this.getClient();
      const doc: Record<string, any> = {
        status: updates.status,
      };
      if (updates.sentAt) doc.sentAt = updates.sentAt.toISOString();
      if (updates.errorMessage !== undefined) doc.errorMessage = updates.errorMessage;
      if (updates.etherealPreviewUrl !== undefined) doc.etherealPreviewUrl = updates.etherealPreviewUrl;

      await client.update({
        index: EMAILS_INDEX_NAME,
        id: emailId,
        doc,
        doc_as_upsert: true,
      });
    } catch (err: any) {
      logger.error({ err: err.message, emailId }, 'Failed to update email in Elasticsearch');
    }
  }

  /**
   * Search emails with tenant isolation and full-text querying
   */
  static async searchEmails(
    userId: string,
    options: {
      q?: string;
      status?: string;
      senderId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ emails: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const fromOffset = (page - 1) * limit;

    const filterMust: any[] = [{ term: { userId } }];

    if (options.status) {
      filterMust.push({ term: { status: options.status.toUpperCase() } });
    }

    if (options.senderId) {
      filterMust.push({ term: { senderId: options.senderId } });
    }

    if (options.from || options.to) {
      const range: any = {};
      if (options.from) range.gte = options.from;
      if (options.to) range.lte = options.to;
      filterMust.push({ range: { scheduledAt: range } });
    }

    let mustClause: any = { match_all: {} };

    if (options.q && options.q.trim().length > 0) {
      mustClause = {
        multi_match: {
          query: options.q.trim(),
          fields: ['recipientEmail^3', 'subject^2', 'senderName', 'senderEmail', 'body'],
          fuzziness: 'AUTO',
        },
      };
    }

    try {
      const client = this.getClient();
      const response = await client.search({
        index: EMAILS_INDEX_NAME,
        from: fromOffset,
        size: limit,
        sort: [{ scheduledAt: { order: 'desc' } }],
        query: {
          bool: {
            must: [mustClause],
            filter: filterMust,
          },
        },
      });

      const hits = response.hits.hits || [];
      const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;

      const emails = hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
      }));

      return { emails, total, page, limit };
    } catch (err: any) {
      logger.error({ err: err.message, userId }, 'Elasticsearch search failed');
      throw err;
    }
  }
}
