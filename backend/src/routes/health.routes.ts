import type { FastifyInstance } from 'fastify';
import { getRedis } from '../redis/client.js';
import { getDb } from '../db/client.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    let redisStatus = 'disconnected';
    let dbStatus = 'disconnected';

    try {
      const redis = getRedis();
      await redis.ping();
      redisStatus = 'connected';
    } catch {
      // redis is down
    }

    try {
      const db = getDb();
      await db.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      // db is down
    }

    return { status: 'ok', redis: redisStatus, db: dbStatus };
  });
}
