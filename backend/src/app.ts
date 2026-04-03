import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from './routes/health.routes.js';
import { saleRoutes } from './routes/sale.routes.js';
import { purchaseRoutes } from './routes/purchase.routes.js';

export async function buildApp(opts: { logger?: boolean; rateLimit?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  await app.register(cors, { origin: true });

  if (opts.rateLimit !== false) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });
  }

  await app.register(healthRoutes);
  await app.register(saleRoutes);
  await app.register(purchaseRoutes);

  return app;
}
