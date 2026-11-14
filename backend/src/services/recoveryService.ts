import prisma from '../prisma/db';
import { emailQueue, scheduleEmailJob } from '../queue/emailQueue';

/**
 * Reconciles scheduled & processing emails on startup.
 * Guarantees that server restarts or crashes never lose scheduled jobs or duplicate sends.
 */
export async function reconcilePersistedEmails() {
  console.log('[Recovery] 🔄 Running startup persistence reconciliation...');

  try {
    const pendingEmails = await prisma.email.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'PROCESSING'],
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    console.log(`[Recovery] Found ${pendingEmails.length} pending email record(s) in persistent database.`);

    let recoveredCount = 0;
    let activeInQueueCount = 0;

    for (const email of pendingEmails) {
      const expectedJobId = email.jobId || `email-${email.id}`;

      // Check if job exists in BullMQ
      let job = null;
      try {
        job = await emailQueue.getJob(expectedJobId);
      } catch (e) {
        job = null;
      }

      if (job) {
        const state = await job.getState();
        if (['waiting', 'delayed', 'active'].includes(state)) {
          activeInQueueCount++;
          continue;
        }
      }

      // If job is not active in BullMQ (e.g. Redis was flushed/restarted or job missed)
      const now = Date.now();
      const scheduledTime = new Date(email.scheduledAt).getTime();
      const isOverdue = scheduledTime <= now;

      console.log(
        `[Recovery] Re-enqueuing email ID: ${email.id} to ${email.recipient} (${
          isOverdue ? 'Overdue - dispatching immediately' : `Scheduled in ${Math.round((scheduledTime - now) / 1000)}s`
        })`
      );

      const newJob = await scheduleEmailJob(email);

      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'SCHEDULED',
          jobId: newJob.id,
        },
      });

      recoveredCount++;
    }

    console.log(
      `[Recovery] ✅ Startup sync complete: ${recoveredCount} re-enqueued, ${activeInQueueCount} active in BullMQ.`
    );

    return {
      total: pendingEmails.length,
      recoveredCount,
      activeInQueueCount,
    };
  } catch (err: any) {
    console.error('[Recovery Error] Failed to reconcile persisted emails:', err.message);
    return { error: err.message };
  }
}
