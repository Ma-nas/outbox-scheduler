import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

export const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    return Math.min(times * 200, 2000);
  },
};

export const redisConnection = redisConfig;

export const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  console.log(`[Redis] Connected to ${redisConfig.host}:${redisConfig.port}`);
});

redisClient.on('error', (err: Error) => {
  console.error('[Redis Error]', err.message);
});

export default redisClient;
