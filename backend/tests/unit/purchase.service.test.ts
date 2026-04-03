import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDecr = vi.fn();
const mockIncr = vi.fn();
const mockSadd = vi.fn();
const mockSismember = vi.fn();
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockSrem = vi.fn();

vi.mock('../../src/redis/client.js', () => ({
  getRedis: vi.fn(() => ({
    decr: mockDecr,
    incr: mockIncr,
    sadd: mockSadd,
    sismember: mockSismember,
    set: mockSet,
    get: mockGet,
    srem: mockSrem,
  })),
}));

import { attemptPurchase, hasUserPurchased, initializeStock, getStockRemaining, compensatePurchase } from '../../src/services/purchase.service.js';
import { PurchaseResult } from '../../src/types/index.js';

describe('purchase.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attemptPurchase', () => {
    it('returns SUCCESS when stock available and user is new', async () => {
      mockDecr.mockResolvedValue(9); // stock after decrement
      mockSadd.mockResolvedValue(1); // new user added
      const result = await attemptPurchase('user1');
      expect(result).toBe(PurchaseResult.SUCCESS);
      expect(mockDecr).toHaveBeenCalledWith('sale:stock');
      expect(mockSadd).toHaveBeenCalledWith('sale:purchases', 'user1');
    });

    it('returns OUT_OF_STOCK when DECR goes below 0 and restores stock', async () => {
      mockDecr.mockResolvedValue(-1); // stock went negative
      mockIncr.mockResolvedValue(0);
      const result = await attemptPurchase('user1');
      expect(result).toBe(PurchaseResult.OUT_OF_STOCK);
      expect(mockIncr).toHaveBeenCalledWith('sale:stock'); // undo DECR
      expect(mockSadd).not.toHaveBeenCalled(); // never reached SADD
    });

    it('returns ALREADY_PURCHASED when user exists and restores stock', async () => {
      mockDecr.mockResolvedValue(8); // stock ok
      mockSadd.mockResolvedValue(0); // user already in set
      mockIncr.mockResolvedValue(9);
      const result = await attemptPurchase('user1');
      expect(result).toBe(PurchaseResult.ALREADY_PURCHASED);
      expect(mockIncr).toHaveBeenCalledWith('sale:stock'); // undo DECR
    });
  });

  describe('hasUserPurchased', () => {
    it('returns true when user is in purchases set', async () => {
      mockSismember.mockResolvedValue(1);
      expect(await hasUserPurchased('user1')).toBe(true);
    });

    it('returns false when user is not in purchases set', async () => {
      mockSismember.mockResolvedValue(0);
      expect(await hasUserPurchased('user1')).toBe(false);
    });
  });

  describe('initializeStock', () => {
    it('sets stock in Redis', async () => {
      mockSet.mockResolvedValue('OK');
      await initializeStock(100);
      expect(mockSet).toHaveBeenCalledWith('sale:stock', 100);
    });
  });

  describe('getStockRemaining', () => {
    it('returns parsed stock count', async () => {
      mockGet.mockResolvedValue('42');
      expect(await getStockRemaining()).toBe(42);
    });

    it('returns 0 when stock is null', async () => {
      mockGet.mockResolvedValue(null);
      expect(await getStockRemaining()).toBe(0);
    });
  });

  describe('compensatePurchase', () => {
    it('restores stock and removes user from purchased set', async () => {
      mockIncr.mockResolvedValue(1);
      mockSrem.mockResolvedValue(1);
      await compensatePurchase('user1');
      expect(mockIncr).toHaveBeenCalledWith('sale:stock');
      expect(mockSrem).toHaveBeenCalledWith('sale:purchases', 'user1');
    });
  });
});
