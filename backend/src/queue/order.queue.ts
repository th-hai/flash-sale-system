import { Queue } from 'bullmq';
import { redisConfig } from '../config.js';

export const ORDER_QUEUE_NAME = 'order-processing';
export const DLQ_NAME = 'order-dlq';

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,   // 1s base → 1s, 2s, 4s, 8s, 16s
  },
};

let orderQueue: Queue | null = null;
let dlq: Queue | null = null;

export function getOrderQueue(): Queue {
  if (!orderQueue) {
    orderQueue = new Queue(ORDER_QUEUE_NAME, {
      connection: { host: redisConfig.host, port: redisConfig.port },
    });
  }
  return orderQueue;
}

export function getDlq(): Queue {
  if (!dlq) {
    dlq = new Queue(DLQ_NAME, {
      connection: { host: redisConfig.host, port: redisConfig.port },
    });
  }
  return dlq;
}

export interface OrderJobData {
  userId: string;
  timestamp: number;
  attemptHistory?: string[];
}

/**
 * Publish order to FIFO queue, grouped by userId.
 *
 * - jobId = userId ensures deduplication (same user can't have multiple
 *   in-flight jobs). BullMQ silently ignores duplicate jobIds.
 * - BullMQ processes jobs in FIFO order (Redis LIST under the hood).
 * - Retries use exponential backoff: 1s, 2s, 4s, 8s, 16s.
 * - After all retries exhausted → moved to DLQ for compensation.
 */
export async function publishOrder(userId: string): Promise<void> {
  const queue = getOrderQueue();
  await queue.add(
    'process-order',
    {
      userId,
      timestamp: Date.now(),
    } satisfies OrderJobData,
    {
      jobId: userId, // FIFO dedup: one job per userId in queue
      attempts: RETRY_CONFIG.maxRetries,
      backoff: RETRY_CONFIG.backoff,
      removeOnComplete: true,
      removeOnFail: false, // keep failed jobs for DLQ inspection
    }
  );
}

export async function closeQueues(): Promise<void> {
  if (orderQueue) {
    await orderQueue.close();
    orderQueue = null;
  }
  if (dlq) {
    await dlq.close();
    dlq = null;
  }
}
