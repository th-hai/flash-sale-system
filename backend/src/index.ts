import { buildApp } from './app.js';
import { serverConfig, saleConfig } from './config.js';
import { getRedis, closeRedis } from './redis/client.js';
import { REDIS_KEYS } from './redis/scripts.js';
import { closeQueues } from './queue/order.queue.js';
import { startOrderWorker, startDlqWorker, closeWorkers } from './queue/order.worker.js';
import { closeDb } from './db/client.js';

async function initializeSale() {
  const redis = getRedis();
  const existing = await redis.get(REDIS_KEYS.stock);
  const lockCount = (await redis.keys('sale:lock:*')).length;

  // Initialize if: key missing, OR stock is 0 with no locks (stale state after flush)
  if (existing === null || (parseInt(existing, 10) <= 0 && lockCount === 0)) {
    await redis.set(REDIS_KEYS.stock, saleConfig.totalStock);
    console.log(`Initialized sale with ${saleConfig.totalStock} items in stock`);
  } else {
    console.log(`Sale already initialized with ${existing} items remaining (${lockCount} purchases)`);
  }
  console.log(`Sale window: ${new Date(saleConfig.startTime).toISOString()} - ${new Date(saleConfig.endTime).toISOString()}`);
}

async function start() {
  const app = await buildApp();

  try {
    await initializeSale();

    // Start queue consumers (SQS → Consumer → DB)
    startOrderWorker();
    startDlqWorker();

    await app.listen({ host: serverConfig.host, port: serverConfig.port });
  } catch (err) {
    app.log.error(err);
    await closeRedis();
    await closeDb();
    process.exit(1);
  }

  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    await closeWorkers();
    await closeQueues();
    await closeDb();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
