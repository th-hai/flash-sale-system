import { saleConfig } from '../config.js';
import { getRedis } from '../redis/client.js';
import { REDIS_KEYS } from '../redis/scripts.js';
import type { SaleStatus, SaleStatusResponse } from '../types/index.js';

export function getSaleStatus(): SaleStatus {
  const now = Date.now();
  if (now < saleConfig.startTime) return 'upcoming';
  if (now > saleConfig.endTime) return 'ended';
  return 'active';
}

export async function getSaleStatusResponse(): Promise<SaleStatusResponse> {
  const redis = getRedis();
  const stockStr = await redis.get(REDIS_KEYS.stock);
  const stockRemaining = stockStr !== null ? parseInt(stockStr, 10) : saleConfig.totalStock;

  return {
    status: getSaleStatus(),
    startsAt: new Date(saleConfig.startTime).toISOString(),
    endsAt: new Date(saleConfig.endTime).toISOString(),
    stockRemaining: Math.max(0, stockRemaining),
  };
}
