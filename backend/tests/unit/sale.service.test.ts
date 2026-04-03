import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing service
vi.mock('../../src/config.js', () => ({
  saleConfig: {
    startTime: 0,
    endTime: 0,
    totalStock: 100,
  },
}));

vi.mock('../../src/redis/client.js', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue('50'),
  })),
}));

import { getSaleStatus } from '../../src/services/sale.service.js';
import { saleConfig } from '../../src/config.js';

describe('getSaleStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns "upcoming" before sale starts', () => {
    const now = Date.now();
    saleConfig.startTime = now + 60000;
    saleConfig.endTime = now + 120000;
    expect(getSaleStatus()).toBe('upcoming');
  });

  it('returns "active" during sale window', () => {
    const now = Date.now();
    saleConfig.startTime = now - 60000;
    saleConfig.endTime = now + 60000;
    expect(getSaleStatus()).toBe('active');
  });

  it('returns "ended" after sale ends', () => {
    const now = Date.now();
    saleConfig.startTime = now - 120000;
    saleConfig.endTime = now - 60000;
    expect(getSaleStatus()).toBe('ended');
  });
});
