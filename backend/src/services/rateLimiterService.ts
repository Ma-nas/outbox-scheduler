import redisClient from '../config/redis';
import { sendSlackRateLimitAlert } from './slackService';
import dotenv from 'dotenv';
dotenv.config();

export const DEFAULT_MAX_EMAILS_PER_HOUR = parseInt(
  process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || process.env.MAX_EMAILS_PER_HOUR || '200',
  10
);

export const MIN_DELAY_BETWEEN_EMAILS_MS = parseInt(
  process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000',
  10
);

/**
 * Returns current hour window string, e.g. "2026-11-14-13"
 */
export function getHourWindowString(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

/**
 * Calculates milliseconds until top of the next hour
 */
export function getDelayUntilNextHour(date: Date = new Date()): { delayMs: number; nextWindow: Date } {
  const nextHour = new Date(date);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const delayMs = Math.max(1000, nextHour.getTime() - date.getTime());
  return { delayMs, nextWindow: nextHour };
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  delayMs?: number;
  nextWindow?: Date;
}

/**
 * Atomically checks and increments hourly email counter for a sender in Redis.
 * If over limit, dispatches Slack alert and returns delay to next hour window.
 */
export async function checkAndIncrementSenderHourlyLimit(
  sender: string,
  configuredLimit?: number,
  emailContext?: {
    emailId: string;
    recipient: string;
    subject: string;
    userId?: string | null;
  }
): Promise<RateLimitCheckResult> {
  const limit = configuredLimit && configuredLimit > 0 ? configuredLimit : DEFAULT_MAX_EMAILS_PER_HOUR;
  const hourWindow = getHourWindowString();
  const key = `ratelimit:sender:${sender}:${hourWindow}`;

  try {
    // Atomic INCR in Redis
    const count = await redisClient.incr(key);
    if (count === 1) {
      // Set TTL to 2 hours
      await redisClient.expire(key, 7200);
    }

    if (count > limit) {
      // Exceeded limit!
      const { delayMs, nextWindow } = getDelayUntilNextHour();

      console.warn(
        `[Rate Limiter] ⚠️ Hourly limit reached for sender "${sender}": ${count}/${limit} emails. Delaying job to next hour window (${nextWindow.toISOString()}).`
      );

      // Trigger live Slack alert if context provided
      if (emailContext) {
        // Send Slack alert (non-blocking)
        sendSlackRateLimitAlert({
          sender,
          currentCount: count,
          limit,
          nextWindow,
          emailId: emailContext.emailId,
          recipient: emailContext.recipient,
          subject: emailContext.subject,
          userId: emailContext.userId,
        }).catch((err) => console.error('[Slack Alert Error]', err));
      }

      return {
        allowed: false,
        currentCount: count,
        limit,
        delayMs,
        nextWindow,
      };
    }

    return {
      allowed: true,
      currentCount: count,
      limit,
    };
  } catch (err: any) {
    console.error(`[Rate Limiter Error] Redis counter check failed:`, err.message);
    // Fail open safely if Redis counter has glitch
    return {
      allowed: true,
      currentCount: 1,
      limit,
    };
  }
}

/**
 * Resets or gets hourly count for testing/debugging
 */
export async function getSenderHourlyCount(sender: string): Promise<number> {
  const hourWindow = getHourWindowString();
  const key = `ratelimit:sender:${sender}:${hourWindow}`;
  const val = await redisClient.get(key);
  return val ? parseInt(val, 10) : 0;
}

export async function resetSenderHourlyCount(sender: string): Promise<void> {
  const hourWindow = getHourWindowString();
  const key = `ratelimit:sender:${sender}:${hourWindow}`;
  await redisClient.del(key);
}
