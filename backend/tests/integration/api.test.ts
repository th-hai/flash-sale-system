import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { buildApp } from '../../src/app.js';
import { saleConfig } from '../../src/config.js';
import { REDIS_KEYS } from '../../src/redis/scripts.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let redis: Redis;

beforeAll(async () => {
  redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 3 });

  // Check if Redis is available
  try {
    await redis.ping();
  } catch {
    console.log('Redis not available, skipping integration tests');
    process.exit(0);
  }

  app = await buildApp({ logger: false });
});

afterAll(async () => {
  await redis.del(REDIS_KEYS.stock, REDIS_KEYS.purchases);
  await redis.quit();
  await app.close();
});

beforeEach(async () => {
  await redis.del(REDIS_KEYS.stock, REDIS_KEYS.purchases);
  await redis.set(REDIS_KEYS.stock, 10);

  const now = Date.now();
  saleConfig.startTime = now - 60000;
  saleConfig.endTime = now + 600000;
  saleConfig.totalStock = 10;
});

describe('GET /health', () => {
  it('returns ok status with redis connected', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.redis).toBe('connected');
  });
});

describe('GET /api/sale/status', () => {
  it('returns active status during sale window', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sale/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('active');
    expect(body.stockRemaining).toBe(10);
    expect(body.startsAt).toBeDefined();
    expect(body.endsAt).toBeDefined();
  });

  it('returns upcoming status before sale starts', async () => {
    const now = Date.now();
    saleConfig.startTime = now + 60000;
    saleConfig.endTime = now + 120000;

    const res = await app.inject({ method: 'GET', url: '/api/sale/status' });
    expect(res.json().status).toBe('upcoming');
  });

  it('returns ended status after sale ends', async () => {
    const now = Date.now();
    saleConfig.startTime = now - 120000;
    saleConfig.endTime = now - 60000;

    const res = await app.inject({ method: 'GET', url: '/api/sale/status' });
    expect(res.json().status).toBe('ended');
  });
});

describe('POST /api/purchase', () => {
  it('returns 201 on successful purchase', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'testuser1' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
  });

  it('returns 409 on duplicate purchase', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'testuser2' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'testuser2' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().reason).toBe('ALREADY_PURCHASED');
  });

  it('returns 410 when stock is depleted', async () => {
    await redis.set(REDIS_KEYS.stock, 1);

    await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'buyer1' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'buyer2' },
    });
    expect(res.statusCode).toBe(410);
    expect(res.json().reason).toBe('OUT_OF_STOCK');
  });

  it('returns 403 when sale is not active', async () => {
    const now = Date.now();
    saleConfig.startTime = now + 60000;
    saleConfig.endTime = now + 120000;

    const res = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'testuser3' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().reason).toBe('SALE_NOT_ACTIVE');
  });

  it('returns 400 with empty userId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('decrements stock correctly', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'stocktest1' },
    });

    const stock = await redis.get(REDIS_KEYS.stock);
    expect(parseInt(stock!, 10)).toBe(9);
  });
});

describe('GET /api/purchase/:userId', () => {
  it('returns purchased: true for buyer', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: { userId: 'checkuser1' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/purchase/checkuser1',
    });
    expect(res.json().purchased).toBe(true);
  });

  it('returns purchased: false for non-buyer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/purchase/nonexistent',
    });
    expect(res.json().purchased).toBe(false);
  });
});
