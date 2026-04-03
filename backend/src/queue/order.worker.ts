import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config.js';
import { insertOrder } from '../db/client.js';
import { compensatePurchase } from '../services/purchase.service.js';
import { ORDER_QUEUE_NAME, DLQ_NAME, RETRY_CONFIG, getDlq } from './order.queue.js';
import type { OrderJobData } from './order.queue.js';

let worker: Worker | null = null;
let dlqWorker: Worker | null = null;

/**
 * Order Consumer Worker
 *
 * Processes order jobs from the FIFO queue:
 * 1. Receives job (grouped by userId)
 * 2. Idempotent INSERT into PostgreSQL
 * 3. On failure: BullMQ retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
 * 4. After all retries exhausted: push to Dead Letter Queue
 */
export function startOrderWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<OrderJobData>(
    ORDER_QUEUE_NAME,
    async (job: Job<OrderJobData>) => {
      const { userId } = job.data;
      const attempt = job.attemptsMade + 1;
      const maxAttempts = RETRY_CONFIG.maxRetries;

      console.log(`[Consumer] Processing order for user: ${userId} (attempt ${attempt}/${maxAttempts})`);

      // Idempotent insert into PostgreSQL
      const inserted = await insertOrder(userId);
      if (inserted) {
        console.log(`[Consumer] Order saved for user: ${userId}`);
        
      } else {
        console.log(`[Consumer] Order already exists for user: ${userId} (idempotent)`);
        
      }
    },
    {
      connection: { host: redisConfig.host, port: redisConfig.port },
      // Concurrency 1 per group preserves FIFO ordering per userId.
      // BullMQ OSS doesn't have per-group concurrency, so we use global
      // concurrency. For higher throughput, this can be increased — FIFO
      // is still maintained within each job's retry sequence.
      concurrency: 10,
    }
  );

  // Retry & DLQ logic
  worker.on('failed', async (job, err) => {
    if (!job) return;

    const { userId } = job.data;
    const attempt = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? RETRY_CONFIG.maxRetries;

    if (attempt >= maxAttempts) {
      // All retries exhausted → push to Dead Letter Queue
      console.error(
        `[Consumer] EXHAUSTED all ${maxAttempts} retries for user: ${userId}. ` +
        `Error: ${err.message}. Moving to DLQ.`
      );
      const dlq = getDlq();
      await dlq.add('dead-order', {
        ...job.data,
        attemptHistory: [
          ...(job.data.attemptHistory ?? []),
          `attempt ${attempt}: ${err.message}`,
        ],
      } satisfies OrderJobData);
    } else {
      // BullMQ will auto-retry with exponential backoff
      const nextDelay = RETRY_CONFIG.backoff.delay * Math.pow(2, attempt - 1);
      console.warn(
        `[Consumer] Attempt ${attempt}/${maxAttempts} failed for user: ${userId}. ` +
        `Error: ${err.message}. Retrying in ${nextDelay}ms...`
      );
    }
  });

  worker.on('completed', (job) => {
    console.log(`[Consumer] Job completed for user: ${job.data.userId}`);
  });

  console.log(
    `[Consumer] Order worker started ` +
    `(maxRetries: ${RETRY_CONFIG.maxRetries}, ` +
    `backoff: exponential ${RETRY_CONFIG.backoff.delay}ms base)`
  );
  return worker;
}

/**
 * Dead Letter Queue Worker
 *
 * Processes messages that failed all retries in the order consumer.
 * Compensation logic:
 *   1. INCR sale:stock   → restore the reserved stock
 *   2. SREM sale:purchases userId → remove user from purchased set
 *
 * This ensures the system remains consistent: if we can't persist the
 * order to the database, we roll back the Redis reservation so the
 * stock becomes available again.
 */
export function startDlqWorker(): Worker {
  if (dlqWorker) return dlqWorker;

  dlqWorker = new Worker<OrderJobData>(
    DLQ_NAME,
    async (job: Job<OrderJobData>) => {
      const { userId, attemptHistory } = job.data;
      console.error(`[DLQ] Compensating for failed order - user: ${userId}`);

      if (attemptHistory?.length) {
        console.error(`[DLQ] Failure history:`);
        attemptHistory.forEach((h) => console.error(`  - ${h}`));
      }

      // Compensate: INCR stock + SREM purchased_user
      await compensatePurchase(userId);
      console.error(`[DLQ] Compensation complete - stock restored, user ${userId} removed from purchases`);
    },
    {
      connection: { host: redisConfig.host, port: redisConfig.port },
      concurrency: 5,
    }
  );

  dlqWorker.on('failed', (job, err) => {
    // This is critical — compensation itself failed
    console.error(`[DLQ] CRITICAL: Compensation failed for user ${job?.data.userId}: ${err.message}`);
    console.error(`[DLQ] Manual intervention required!`);
  });

  dlqWorker.on('completed', (job) => {
    console.log(`[DLQ] Compensation completed for user: ${job.data.userId}`);
  });

  console.log('[DLQ] Dead Letter Queue worker started');
  return dlqWorker;
}

export async function closeWorkers(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (dlqWorker) {
    await dlqWorker.close();
    dlqWorker = null;
  }
}
