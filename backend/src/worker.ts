import dotenv from 'dotenv';
dotenv.config();

import redisClient from './config/redis';
import { getTransporterForSender } from './config/mailer';
import { initElasticsearch } from './config/elasticsearch';
import { initWorker, closeWorker } from './queue/emailWorker';
import { reconcilePersistedEmails } from './services/recoveryService';

async function startStandaloneWorker() {
  console.log('================================================================');
  console.log('  ⚡ REACHINBOX STANDALONE BULLMQ WORKER SERVICE STARTING');
  console.log('================================================================');

  try {
    await redisClient.ping();
    console.log('[Worker Service] Connected to Redis.');

    await getTransporterForSender('default');
    console.log('[Worker Service] Nodemailer Ethereal ready.');

    await initElasticsearch();

    await reconcilePersistedEmails();

    initWorker();

    console.log('[Worker Service] Worker is actively listening for email jobs.');
  } catch (err: any) {
    console.error('[Worker Service Fatal Error]', err);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('\n[Worker Service] Shutting down worker...');
  await closeWorker();
  await redisClient.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startStandaloneWorker();
