import axios from 'axios';
import prisma from '../prisma/db';
import dotenv from 'dotenv';
dotenv.config();

let globalSlackWebhook = process.env.SLACK_WEBHOOK_URL || null;

export interface RateLimitAlertPayload {
  sender: string;
  currentCount: number;
  limit: number;
  nextWindow: Date;
  emailId: string;
  recipient: string;
  subject: string;
  userId?: string | null;
}

/**
 * Sends a live Slack notification when an hourly sender rate limit is exceeded
 */
export async function sendSlackRateLimitAlert(payload: RateLimitAlertPayload): Promise<boolean> {
  let webhookUrl = globalSlackWebhook;

  // Check if user has specific Slack webhook saved in DB
  if (payload.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { slackWebhookUrl: true },
      });
      if (user?.slackWebhookUrl) {
        webhookUrl = user.slackWebhookUrl;
      }
    } catch (e: any) {
      console.warn(`[Slack] Could not load user webhook:`, e.message);
    }
  }

  if (!webhookUrl) {
    // If not connected, do not crash as specified in requirements
    console.log(`[Slack] Rate limit reached for ${payload.sender}, but no Slack webhook is connected. Skipping notification.`);
    return false;
  }

  const message = {
    text: `🚨 *ReachInbox Rate Limit Alert* - Hourly limit exceeded for \`${payload.sender}\``,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 ReachInbox Hourly Rate Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender Account:*\n\`${payload.sender}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Current Hourly Count:*\n*${payload.currentCount}* / *${payload.limit}* emails`,
          },
          {
            type: 'mrkdwn',
            text: `*Next Available Window:*\n<!date^${Math.floor(payload.nextWindow.getTime() / 1000)}^{date_num} {time_secs}|${payload.nextWindow.toISOString()}>`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\nDelayed & Preserved in Queue`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected Lead:* \`${payload.recipient}\`\n*Subject:* "${payload.subject}"\n*Action Taken:* BullMQ job automatically rescheduled into the next hour window without dropping.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🛡️ Outbox Labs Rate Limiter • BullMQ + Redis • ${new Date().toLocaleTimeString()}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(webhookUrl, message, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    console.log(`[Slack] ✅ Live rate limit alert delivered successfully to Slack! (Status: ${response.status})`);
    return true;
  } catch (err: any) {
    console.error(`[Slack Error] Failed to dispatch live Slack webhook:`, err.message);
    return false;
  }
}

/**
 * Verifies or tests a Slack webhook URL
 */
export async function testSlackConnection(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const testPayload = {
      text: '✅ *ReachInbox Slack Integration Connected Successfully!*',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🎉 *Slack Connected!* You will now receive live alerts whenever an hourly sender rate limit is hit.',
          },
        },
      ],
    };

    const res = await axios.post(webhookUrl, testPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });

    if (res.status === 200) {
      return { success: true, message: 'Test notification sent to Slack successfully.' };
    }
    return { success: false, message: `Slack returned status: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to send test message to Slack' };
  }
}

export function setGlobalSlackWebhook(url: string | null) {
  globalSlackWebhook = url;
}

export function getGlobalSlackWebhook(): string | null {
  return globalSlackWebhook;
}
