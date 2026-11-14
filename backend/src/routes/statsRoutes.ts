import express, { Request, Response } from 'express';
import prisma from '../prisma/db';
import { getQueueMetrics } from '../queue/emailQueue';
import { workerConcurrency, rateLimitMax, rateLimitDuration } from '../queue/emailWorker';
import { isElasticsearchAvailable } from '../config/elasticsearch';
import { getGlobalSlackWebhook } from '../services/slackService';
import { DEFAULT_MAX_EMAILS_PER_HOUR, MIN_DELAY_BETWEEN_EMAILS_MS } from '../services/rateLimiterService';

const router = express.Router();

/**
 * GET /api/stats
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [
      total,
      scheduled,
      sent,
      failed,
      cancelled,
      processing,
    ] = await Promise.all([
      prisma.email.count(),
      prisma.email.count({ where: { status: 'SCHEDULED' } }),
      prisma.email.count({ where: { status: 'SENT' } }),
      prisma.email.count({ where: { status: 'FAILED' } }),
      prisma.email.count({ where: { status: 'CANCELLED' } }),
      prisma.email.count({ where: { status: 'PROCESSING' } }),
    ]);

    const queueMetrics = await getQueueMetrics();
    const esAvailable = isElasticsearchAvailable();
    const slackConnected = !!getGlobalSlackWebhook();

    res.json({
      database: {
        total,
        scheduled,
        sent,
        failed,
        cancelled,
        processing,
      },
      queue: queueMetrics,
      elasticsearch: {
        connected: esAvailable,
        mode: esAvailable ? 'Elasticsearch Cluster' : 'Database Full-Text Fallback',
      },
      slack: {
        connected: slackConnected,
      },
      config: {
        concurrency: workerConcurrency,
        minDelayBetweenEmailsMs: MIN_DELAY_BETWEEN_EMAILS_MS,
        defaultHourlyLimitPerSender: DEFAULT_MAX_EMAILS_PER_HOUR,
        globalLimiter: {
          max: rateLimitMax,
          durationMs: rateLimitDuration,
        },
        redis: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: process.env.REDIS_PORT || 6379,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve stats: ' + err.message });
  }
});

export default router;
