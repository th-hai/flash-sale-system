import { getRedis } from '../redis/client.js';
import { REDIS_KEYS } from '../redis/scripts.js';
import { PurchaseResult } from '../types/index.js';

/**
 * Attempt a purchase using atomic Redis operations:
 * 1. DECR stock → if < 0, INCR back and reject (out of stock)
 * 2. SADD purchased_users userId → if duplicate (returns 0), INCR stock back and reject
 */
export async function attemptPurchase(userId: string): Promise<PurchaseResult> {
  const redis = getRedis();

  // Step 1: Reserve stock using atomic DECR
  const stock = await redis.decr(REDIS_KEYS.stock);
  if (stock < 0) {
    // Undo: restore the stock we just took
    await redis.incr(REDIS_KEYS.stock);
    return PurchaseResult.OUT_OF_STOCK;
  }

  // Step 2: Add user to purchased set (SADD returns 0 if already exists)
  const added = await redis.sadd(REDIS_KEYS.purchases, userId);
  if (added === 0) {
    // Undo: user already purchased, restore the stock
    await redis.incr(REDIS_KEYS.stock);
    return PurchaseResult.ALREADY_PURCHASED;
  }

  return PurchaseResult.SUCCESS;
}

export async function hasUserPurchased(userId: string): Promise<boolean> {
  const redis = getRedis();
  return (await redis.sismember(REDIS_KEYS.purchases, userId)) === 1;
}

export async function initializeStock(stock: number): Promise<void> {
  const redis = getRedis();
  await redis.set(REDIS_KEYS.stock, stock);
}

export async function getStockRemaining(): Promise<number> {
  const redis = getRedis();
  const stock = await redis.get(REDIS_KEYS.stock);
  return stock !== null ? Math.max(0, parseInt(stock, 10)) : 0;
}

/**
 * Compensation for failed order processing (DLQ handler):
 * Restore stock and remove user from purchased set
 */
export async function compensatePurchase(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.incr(REDIS_KEYS.stock);
  await redis.srem(REDIS_KEYS.purchases, userId);
}
