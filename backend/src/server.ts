import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

import redisClient from './config/redis';
import { getTransporterForSender } from './config/mailer';
import { initElasticsearch } from './config/elasticsearch';
import { initWorker, closeWorker } from './queue/emailWorker';
import { reconcilePersistedEmails } from './services/recoveryService';

import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import statsRoutes from './routes/statsRoutes';
import slackRoutes from './routes/slackRoutes';
import bullBoardRouter from './routes/adminRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Live BullMQ Queue Monitor Dashboard
app.use('/admin/queues', bullBoardRouter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/slack', slackRoutes);

// Health Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'reachinbox-outbox-scheduler',
  });
});

let server: any = null;

export async function bootstrap() {
  console.log('================================================================');
  console.log('  🚀 REACHINBOX OUTBOX EMAIL SCHEDULER BACKEND INITIALIZING');
  console.log('================================================================');

  try {
    // 1. Redis Connection Ping
    await redisClient.ping();
    console.log('[Bootstrap] ✅ Redis is reachable and responsive.');

    // 2. Initialize Nodemailer (Ethereal Email)
    await getTransporterForSender('default');

    // 3. Initialize Elasticsearch (with resilient fallback)
    await initElasticsearch();

    // 4. Start BullMQ In-Process Worker (if enabled)
    if (process.env.START_WORKER !== 'false') {
      initWorker();
    }

    // 5. Persistence Recovery: Reconcile DB and BullMQ on startup
    await reconcilePersistedEmails();

    // 6. Listen on Port
    server = app.listen(PORT, () => {
      console.log(`[Bootstrap] 🌐 API Server:       http://localhost:${PORT}`);
      console.log(`[Bootstrap] 📊 BullMQ Dashboard: http://localhost:${PORT}/admin/queues`);
      console.log(`[Bootstrap] 🩺 Health Endpoint:   http://localhost:${PORT}/api/health`);
      console.log(`[Bootstrap] 📬 Ready to schedule & process emails at scale!`);
      console.log('================================================================');
    });
  } catch (err: any) {
    console.error('[Bootstrap Error]', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}. Shutting down cleanly...`);
  if (server) {
    server.close(() => {
      console.log('[Shutdown] Express server closed.');
    });
  }
  await closeWorker();
  try {
    await redisClient.quit();
    console.log('[Shutdown] Redis disconnected.');
  } catch (e) {}
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  bootstrap();
}

export default app;
