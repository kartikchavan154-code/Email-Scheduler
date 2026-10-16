import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface RateLimitCheckResult {
  status: 'ALLOWED' | 'RATE_LIMITED' | 'MIN_DELAY_VIOLATION';
  currentCount: number;
  limit: number;
  remaining: number;
  delayMs?: number;
  nextEligibleTimeMs?: number;
  isFirstRateLimitHit?: boolean;
  windowKey: string;
}

export class RateLimiterService {
  /**
   * Generates the current hourly window identifier based on UTC or configured timezone
   * e.g., "2026-10-16-22"
   */
  static getHourlyWindowKey(timestampMs: number = Date.now()): { key: string; windowStartMs: number; windowEndMs: number } {
    const HOUR_MS = 60 * 60 * 1000;
    const windowStartMs = Math.floor(timestampMs / HOUR_MS) * HOUR_MS;
    const windowEndMs = windowStartMs + HOUR_MS;

    const date = new Date(windowStartMs);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');

    return {
      key: `${yyyy}-${mm}-${dd}-${hh}`,
      windowStartMs,
      windowEndMs,
    };
  }

  /**
   * Concurrency-safe atomic check & reservation using Lua script.
   * Enforces both:
   * 1. Sender-specific hourly rate limit
   * 2. Sender-specific minimum inter-send delay
   */
  static async reserveSendSlot(
    senderId: string,
    hourlyLimit: number,
    minDelayMs: number = env.MIN_DELAY_BETWEEN_SENDS_MS
  ): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const { key: windowKeyStr, windowEndMs } = this.getHourlyWindowKey(now);

    const counterKey = `ratelimit:sender:${senderId}:window:${windowKeyStr}`;
    const lastSendKey = `ratelimit:sender:${senderId}:last_send_timestamp`;
    const notifiedKey = `ratelimit:sender:${senderId}:window:${windowKeyStr}:notified`;

    // Atomic Lua script
    const luaScript = `
      local counterKey = KEYS[1]
      local lastSendKey = KEYS[2]
      local notifiedKey = KEYS[3]

      local hourlyLimit = tonumber(ARGV[1])
      local minDelayMs = tonumber(ARGV[2])
      local nowMs = tonumber(ARGV[3])
      local windowEndMs = tonumber(ARGV[4])

      -- Check 1: Minimum inter-send delay
      local lastSend = redis.call('get', lastSendKey)
      if lastSend then
        local elapsed = nowMs - tonumber(lastSend)
        if elapsed < minDelayMs then
          local requiredDelay = minDelayMs - elapsed
          local currentCount = tonumber(redis.call('get', counterKey) or '0')
          return {'MIN_DELAY_VIOLATION', currentCount, requiredDelay, 0}
        end
      end

      -- Check 2: Hourly Rate Limit
      local currentCount = tonumber(redis.call('get', counterKey) or '0')
      if currentCount >= hourlyLimit then
        -- Atomically check if this is the first time rate limit is hit in this window
        local isFirst = redis.call('set', notifiedKey, '1', 'NX', 'EX', 7200)
        local isFirstFlag = isFirst and 1 or 0
        local nextEligibleDelay = math.max(1000, windowEndMs - nowMs)
        return {'RATE_LIMITED', currentCount, nextEligibleDelay, isFirstFlag}
      end

      -- Reserve capacity
      local newCount = redis.call('incr', counterKey)
      if newCount == 1 then
        redis.call('pexpireat', counterKey, windowEndMs + 60000)
      end

      -- Update last send timestamp
      redis.call('set', lastSendKey, tostring(nowMs), 'EX', 3600)

      return {'ALLOWED', newCount, 0, 0}
    `;

    try {
      const result = (await redis.eval(
        luaScript,
        3,
        counterKey,
        lastSendKey,
        notifiedKey,
        hourlyLimit.toString(),
        minDelayMs.toString(),
        now.toString(),
        windowEndMs.toString()
      )) as [string, number, number, number];

      const [status, count, delay, isFirst] = result;
      const currentCount = Number(count);
      const remaining = Math.max(0, hourlyLimit - currentCount);

      if (status === 'RATE_LIMITED') {
        return {
          status: 'RATE_LIMITED',
          currentCount,
          limit: hourlyLimit,
          remaining: 0,
          delayMs: Number(delay),
          nextEligibleTimeMs: now + Number(delay),
          isFirstRateLimitHit: Number(isFirst) === 1,
          windowKey: windowKeyStr,
        };
      }

      if (status === 'MIN_DELAY_VIOLATION') {
        return {
          status: 'MIN_DELAY_VIOLATION',
          currentCount,
          limit: hourlyLimit,
          remaining,
          delayMs: Number(delay),
          windowKey: windowKeyStr,
        };
      }

      return {
        status: 'ALLOWED',
        currentCount,
        limit: hourlyLimit,
        remaining,
        windowKey: windowKeyStr,
      };
    } catch (err: any) {
      logger.error({ err: err.message, senderId }, 'Error running Redis rate limit reservation Lua script');
      // In case of Redis script issue, fallback to conservative allow
      return {
        status: 'ALLOWED',
        currentCount: 0,
        limit: hourlyLimit,
        remaining: hourlyLimit,
        windowKey: windowKeyStr,
      };
    }
  }

  /**
   * Release reserved slot if email processing fails before SMTP send
   */
  static async releaseReservation(senderId: string): Promise<void> {
    const { key: windowKeyStr } = this.getHourlyWindowKey();
    const counterKey = `ratelimit:sender:${senderId}:window:${windowKeyStr}`;
    try {
      const count = await redis.decr(counterKey);
      if (count < 0) {
        await redis.set(counterKey, 0);
      }
    } catch (err: any) {
      logger.warn({ err: err.message, senderId }, 'Failed to release rate limit reservation');
    }
  }

  /**
   * Retrieve current rate limit status for dashboard inspection
   */
  static async getSenderHourlyStatus(senderId: string, limit: number): Promise<{
    currentCount: number;
    remaining: number;
    limit: number;
    windowKey: string;
    windowEndMs: number;
  }> {
    const { key: windowKeyStr, windowEndMs } = this.getHourlyWindowKey();
    const counterKey = `ratelimit:sender:${senderId}:window:${windowKeyStr}`;

    const countStr = await redis.get(counterKey);
    const currentCount = countStr ? parseInt(countStr, 10) : 0;
    const remaining = Math.max(0, limit - currentCount);

    return {
      currentCount,
      remaining,
      limit,
      windowKey: windowKeyStr,
      windowEndMs,
    };
  }
}
