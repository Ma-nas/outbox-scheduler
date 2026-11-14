import express, { Request, Response } from 'express';
import prisma from '../prisma/db';
import { testSlackConnection, setGlobalSlackWebhook, getGlobalSlackWebhook } from '../services/slackService';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './authRoutes';

const router = express.Router();

function getUserIdFromReq(req: Request): string | null {
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
 * GET /api/slack/status
 */
router.get('/status', async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  let webhookUrl = getGlobalSlackWebhook();
  let channel = '#general';

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slackWebhookUrl: true, slackChannel: true },
    });
    if (user?.slackWebhookUrl) {
      webhookUrl = user.slackWebhookUrl;
      channel = user.slackChannel || '#general';
    }
  }

  res.json({
    connected: !!webhookUrl,
    webhookConfigured: !!webhookUrl,
    channel: webhookUrl ? channel : null,
  });
});

/**
 * POST /api/slack/connect
 * Saves Slack webhook / OAuth credentials
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, channel } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl is required' });
    }

    // Verify webhook
    const test = await testSlackConnection(webhookUrl);
    if (!test.success) {
      return res.status(400).json({ error: 'Slack webhook test failed: ' + test.message });
    }

    const userId = getUserIdFromReq(req);
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackWebhookUrl: webhookUrl,
          slackChannel: channel || '#reachinbox-alerts',
        },
      });
    }

    // Set active in memory as well
    setGlobalSlackWebhook(webhookUrl);

    res.json({
      message: 'Slack connected successfully! Test notification sent to channel.',
      connected: true,
      channel: channel || '#reachinbox-alerts',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to connect Slack: ' + err.message });
  }
});

/**
 * POST /api/slack/test
 * Triggers a live test Slack notification
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromReq(req);
    let webhookUrl = req.body.webhookUrl || getGlobalSlackWebhook();

    if (!webhookUrl && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      webhookUrl = user?.slackWebhookUrl || null;
    }

    if (!webhookUrl) {
      return res.status(400).json({ error: 'No Slack webhook configured. Please connect Slack first.' });
    }

    const result = await testSlackConnection(webhookUrl);
    if (result.success) {
      res.json({ success: true, message: 'Live notification dispatched to your Slack channel!' });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/slack/disconnect
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromReq(req);
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackWebhookUrl: null,
          slackChannel: null,
        },
      });
    }
    setGlobalSlackWebhook(null);
    res.json({ message: 'Slack disconnected successfully', connected: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
