import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { sendMail } from '../config/mailer';
import { indexEmailDocument } from '../config/elasticsearch';
import { checkAndIncrementSenderHourlyLimit, MIN_DELAY_BETWEEN_EMAILS_MS } from '../services/rateLimiterService';
import { emailQueue, EmailJobData, QUEUE_NAME } from './emailQueue';
import prisma from '../prisma/db';
import dotenv from 'dotenv';
dotenv.config();

export const workerConcurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
export const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);
export const rateLimitDuration = parseInt(process.env.RATE_LIMIT_DURATION_MS || '1000', 10);

let workerInstance: Worker<EmailJobData> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function initWorker(): Worker<EmailJobData> {
  if (workerInstance) return workerInstance;

  console.log(`[Worker] Initializing ReachInbox BullMQ Worker for queue: "${QUEUE_NAME}"`);
  console.log(`         Concurrency: ${workerConcurrency} threads`);
  console.log(`         Provider Delay: ${MIN_DELAY_BETWEEN_EMAILS_MS}ms minimum between sends`);
  console.log(`         Global Limiter: ${rateLimitMax} jobs per ${rateLimitDuration}ms`);

  workerInstance = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, sender, recipient, subject, body, userId, minDelaySeconds, hourlyLimit } = job.data;
      console.log(`[Worker] [Job ${job.id}] Dispatched to lead: "${recipient}" from sender: "${sender}"`);

      // 1. Mark as PROCESSING in Database
      try {
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'PROCESSING',
            attempts: { increment: 1 },
          },
        });
      } catch (err: any) {
        console.warn(`[Worker] Could not mark PROCESSING for ${emailId}:`, err.message);
      }

      // 2. Enforce Hourly Sender Rate Limiting (Redis-backed counter across instances)
      const rateCheck = await checkAndIncrementSenderHourlyLimit(sender, hourlyLimit, {
        emailId,
        recipient,
        subject,
        userId,
      });

      if (!rateCheck.allowed && rateCheck.nextWindow && rateCheck.delayMs) {
        console.warn(
          `[Worker Rate Limit] Sender "${sender}" exceeded hourly quota (${rateCheck.currentCount}/${rateCheck.limit}).`
        );
        console.warn(
          `                     Rescheduling email ${emailId} to next hour: ${rateCheck.nextWindow.toISOString()} (Slack Alert sent).`
        );

        // Update DB record to next window
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SCHEDULED',
            scheduledAt: rateCheck.nextWindow,
          },
        });

        // Re-enqueue into BullMQ for the next hour window preserving FIFO
        await emailQueue.add(
          'send-email',
          job.data,
          {
            jobId: `email-${emailId}-${Date.now()}`,
            delay: rateCheck.delayMs,
          }
        );

        return {
          rateLimited: true,
          sender,
          recipient,
          rescheduledTo: rateCheck.nextWindow,
        };
      }

      // 3. Provider Throttling: Minimum Delay Between Individual Email Sends
      const delayMs = (minDelaySeconds && minDelaySeconds > 0 ? minDelaySeconds * 1000 : MIN_DELAY_BETWEEN_EMAILS_MS);
      if (delayMs > 0) {
        console.log(`[Worker Throttle] Provider throttle delay applied: ${delayMs}ms before SMTP dispatch...`);
        await sleep(delayMs);
      }

      // 4. Send Email via Ethereal SMTP
      try {
        const mailResult = await sendMail({
          from: sender,
          to: recipient,
          subject,
          body,
        });

        const sentAt = new Date();

        // 5. Update Status to SENT in Database
        const updatedEmail = await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            previewUrl: mailResult.previewUrl,
            messageId: mailResult.messageId,
            errorReason: null,
          },
        });

        // 6. Index into Elasticsearch
        await indexEmailDocument(updatedEmail);

        console.log(`[Worker] [Job ${job.id}] ✅ Successfully sent to "${recipient}"!`);
        if (mailResult.previewUrl) {
          console.log(`         🔗 Ethereal Preview URL: ${mailResult.previewUrl}`);
        }

        return {
          success: true,
          emailId,
          recipient,
          sentAt,
          previewUrl: mailResult.previewUrl,
        };
      } catch (sendError: any) {
        console.error(`[Worker] [Job ${job.id}] ❌ Failed sending to "${recipient}":`, sendError.message);

        // Update DB to FAILED
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorReason: sendError.message,
          },
        }).catch((e) => console.error('[Worker DB Update Error]', e.message));

        throw sendError;
      }
    },
    {
      connection: redisConnection,
      concurrency: workerConcurrency,
      limiter: {
        max: rateLimitMax,
        duration: rateLimitDuration,
      },
    }
  );

  workerInstance.on('ready', () => {
    console.log(`[Worker] BullMQ Worker is READY and listening on queue "${QUEUE_NAME}".`);
  });

  workerInstance.on('completed', (job: Job<EmailJobData>, result: any) => {
    if (result?.rateLimited) {
      console.log(`[Worker Event] Job ${job.id} rate-limited and rescheduled to ${result.rescheduledTo}`);
    } else {
      console.log(`[Worker Event] Job ${job.id} dispatched to ${result?.recipient}`);
    }
  });

  workerInstance.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
    console.error(`[Worker Event] Job ${job?.id} failed: ${err.message}`);
  });

  workerInstance.on('error', (err: Error) => {
    console.error(`[Worker Event Error]`, err.message);
  });

  return workerInstance;
}

export async function closeWorker(): Promise<void> {
  if (workerInstance) {
    console.log('[Worker] Gracefully closing BullMQ worker...');
    await workerInstance.close();
    workerInstance = null;
    console.log('[Worker] Worker closed.');
  }
}
