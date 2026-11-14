import { Queue, Job } from 'bullmq';
import { redisConnection } from '../config/redis';

export const QUEUE_NAME = 'reachinbox-email-queue';

export interface EmailJobData {
  emailId: string;
  userId?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string | Date;
  minDelaySeconds?: number;
  hourlyLimit?: number;
}

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed for 24h
      count: 2000,
    },
    removeOnFail: {
      age: 48 * 3600, // keep failed for 48h
      count: 5000,
    },
  },
});

/**
 * Schedules an email job with BullMQ delayed queue
 */
export async function scheduleEmailJob(emailRecord: any): Promise<Job<EmailJobData>> {
  const scheduledTime = new Date(emailRecord.scheduledAt).getTime();
  const now = Date.now();
  const delay = Math.max(0, scheduledTime - now);

  const jobId = `email-${emailRecord.id}`;

  // Check if job already exists and remove previous instance
  try {
    const existingJob = await emailQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }
  } catch (e) {
    // Ignore
  }

  const job = await emailQueue.add(
    'send-email',
    {
      emailId: emailRecord.id,
      userId: emailRecord.userId,
      sender: emailRecord.sender || 'outbox-agent-1@reachinbox.ai',
      recipient: emailRecord.recipient,
      subject: emailRecord.subject,
      body: emailRecord.body,
      scheduledAt: emailRecord.scheduledAt,
      minDelaySeconds: emailRecord.minDelaySeconds || 2,
      hourlyLimit: emailRecord.hourlyLimit || 200,
    },
    {
      jobId,
      delay,
    }
  );

  return job;
}

/**
 * Removes an email job by ID
 */
export async function removeEmailJob(jobId: string): Promise<boolean> {
  if (!jobId) return false;
  try {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
  } catch (err: any) {
    console.warn(`[Queue] Failed to remove job ${jobId}:`, err.message);
  }
  return false;
}

/**
 * Returns real-time metrics for BullMQ
 */
export async function getQueueMetrics() {
  try {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      delayed,
      completed,
      failed,
      total: waiting + active + delayed,
    };
  } catch (err: any) {
    return {
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      total: 0,
      error: err.message,
    };
  }
}
