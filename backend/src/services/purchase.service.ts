import { getRedis } from '../redis/client.js';
import { REDIS_KEYS } from '../redis/scripts.js';
import { PurchaseResult } from '../types/index.js';

/**
 * Attempt a purchase using atomic Redis operations:
 * 1. DECR stock → if < 0, INCR back and reject (out of stock)
 * 2. SETNX lock:userId → if key exists (returns null), INCR stock back and reject
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

  // Step 2: Lock user via SETNX (returns null if key already exists)
  const locked = await redis.set(REDIS_KEYS.userLock(userId), '1', 'NX');
  if (locked === null) {
    // Undo: user already purchased, restore the stock
    await redis.incr(REDIS_KEYS.stock);
    return PurchaseResult.ALREADY_PURCHASED;
  }

  return PurchaseResult.SUCCESS;
}

export async function hasUserPurchased(userId: string): Promise<boolean> {
  const redis = getRedis();
  const exists = await redis.exists(REDIS_KEYS.userLock(userId));
  return exists === 1;
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
 * Compensation for failed order processing:
 * Restore stock and release user lock
 */
export async function compensatePurchase(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.incr(REDIS_KEYS.stock);
  await redis.del(REDIS_KEYS.userLock(userId));
}
