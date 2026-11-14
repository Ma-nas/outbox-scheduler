import express, { Request, Response } from 'express';
import multer from 'multer';
import prisma from '../prisma/db';
import { scheduleEmailJob, removeEmailJob } from '../queue/emailQueue';
import { searchEmails, indexEmailDocument } from '../config/elasticsearch';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './authRoutes';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function getUserId(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/emails/upload-leads
 * Parses CSV or TXT lead file and returns extracted valid email addresses
 */
router.post('/upload-leads', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let content = '';

    if (req.file) {
      content = req.file.buffer.toString('utf-8');
    } else if (req.body.text) {
      content = req.body.text;
    } else {
      return res.status(400).json({ error: 'Please upload a CSV/text file or provide raw text.' });
    }

    // Match all email patterns
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailRegex) || [];
    const uniqueEmails = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));

    res.json({
      message: `Extracted ${uniqueEmails.length} unique lead emails.`,
      count: uniqueEmails.length,
      emails: uniqueEmails,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

/**
 * POST /api/emails/schedule
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const {
      sender,
      recipient,
      subject,
      body,
      scheduledAt,
      minDelaySeconds,
      hourlyLimit,
    } = req.body;

    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: 'recipient, subject, and body are required' });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt timestamp' });
    }

    const userId = getUserId(req);

    const email = await prisma.email.create({
      data: {
        userId,
        sender: sender || 'outbox-agent-1@reachinbox.ai',
        recipient: recipient.trim().toLowerCase(),
        subject,
        body,
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
        minDelaySeconds: minDelaySeconds ? parseInt(minDelaySeconds, 10) : 2,
        hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : 200,
      },
    });

    const job = await scheduleEmailJob(email);

    const updated = await prisma.email.update({
      where: { id: email.id },
      data: { jobId: job.id },
    });

    // Index into search
    indexEmailDocument(updated).catch(() => {});

    console.log(`[API] Email scheduled: ID=${updated.id}, Recipient=${recipient}, Sender=${email.sender}`);

    res.status(201).json({
      message: 'Email scheduled successfully',
      email: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to schedule email: ' + err.message });
  }
});

/**
 * POST /api/emails/batch
 * Bulk schedule from CSV leads
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const {
      recipients, // Array of email strings
      sender,
      subject,
      body,
      startTime,
      delayBetweenEmails = 2, // seconds
      hourlyLimit = 200,
    } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array is required' });
    }

    if (!subject || !body) {
      return res.status(400).json({ error: 'subject and body are required' });
    }

    const userId = getUserId(req);
    const start = startTime ? new Date(startTime) : new Date();
    const delayStepMs = (parseInt(delayBetweenEmails, 10) || 2) * 1000;

    const scheduledEmails = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim().toLowerCase();
      // Calculate staggered schedule timestamp
      const itemScheduledAt = new Date(start.getTime() + i * delayStepMs);

      const email = await prisma.email.create({
        data: {
          userId,
          sender: sender || 'outbox-agent-1@reachinbox.ai',
          recipient,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: itemScheduledAt,
          minDelaySeconds: parseInt(delayBetweenEmails, 10) || 2,
          hourlyLimit: parseInt(hourlyLimit, 10) || 200,
        },
      });

      const job = await scheduleEmailJob(email);

      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { jobId: job.id },
      });

      indexEmailDocument(updated).catch(() => {});
      scheduledEmails.push(updated);
    }

    res.status(201).json({
      message: `Successfully scheduled ${scheduledEmails.length} emails with ${delayBetweenEmails}s stagger`,
      count: scheduledEmails.length,
      emails: scheduledEmails,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Batch scheduling failed: ' + err.message });
  }
});

/**
 * GET /api/emails/search
 * Elasticsearch-backed search
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const status = (req.query.status as string) || 'ALL';

    const searchResult = await searchEmails(query, status);
    res.json(searchResult);
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed: ' + err.message });
  }
});

/**
 * GET /api/emails
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { recipient: { contains: String(search) } },
        { subject: { contains: String(search) } },
        { sender: { contains: String(search) } },
      ];
    }

    const take = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const skip = (Math.max(1, parseInt(String(page), 10)) - 1) * take;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.email.count({ where }),
    ]);

    res.json({
      emails,
      pagination: {
        page: parseInt(String(page), 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch emails: ' + err.message });
  }
});

/**
 * DELETE /api/emails/:id
 * Cancels a scheduled email
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const email = await prisma.email.findUnique({
      where: { id: req.params.id },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    if (email.status !== 'SCHEDULED') {
      return res.status(400).json({
        error: `Cannot cancel email in status: ${email.status}. Only SCHEDULED emails can be cancelled.`,
      });
    }

    if (email.jobId) {
      await removeEmailJob(email.jobId);
    }

    const updated = await prisma.email.update({
      where: { id: email.id },
      data: { status: 'CANCELLED' },
    });

    res.json({
      message: 'Email scheduled job cancelled successfully',
      email: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel email: ' + err.message });
  }
});

/**
 * POST /api/emails/test-load
 * Helper endpoint to fire burst load and demonstrate rate limiting & Slack alerts
 */
router.post('/test-load', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.body.count || '6', 10);
    const hourlyLimit = parseInt(req.body.hourlyLimit || '3', 10); // set lower limit to trigger throttle!
    const sender = req.body.sender || 'load-test-agent@reachinbox.ai';
    const userId = getUserId(req);

    console.log(`[Load Test] Bursting ${count} emails with hourlyLimit=${hourlyLimit} for ${sender}...`);

    const scheduled = [];
    const now = new Date();

    for (let i = 1; i <= count; i++) {
      const email = await prisma.email.create({
        data: {
          userId,
          sender,
          recipient: `lead-${i}@reachinbox-eval.com`,
          subject: `[ReachInbox Load Test #${i}] Rate Limit & Delay Verification`,
          body: `<p>Evaluation payload <strong>#${i} of ${count}</strong> testing BullMQ concurrency, 2s delay, and hourly sender limit.</p>`,
          status: 'SCHEDULED',
          scheduledAt: now,
          minDelaySeconds: 2,
          hourlyLimit,
        },
      });

      const job = await scheduleEmailJob(email);

      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { jobId: job.id },
      });

      scheduled.push(updated);
    }

    res.status(201).json({
      message: `Enqueued ${count} emails with hourlyLimit=${hourlyLimit}. Notice how worker processes first ${hourlyLimit} and reschedules the rest to the next hour with Slack alert!`,
      count,
      hourlyLimit,
      sender,
      emails: scheduled,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Load test failed: ' + err.message });
  }
});

export default router;
