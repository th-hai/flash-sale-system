import Redis from 'ioredis';
import { buildApp } from '../../src/app.js';
import { saleConfig } from '../../src/config.js';
import { REDIS_KEYS } from '../../src/redis/scripts.js';

const TOTAL_STOCK = 100;
const TOTAL_USERS = 1000;

async function runStressTest() {
  console.log('=== Flash Sale Stress Test ===\n');
  console.log(`Stock: ${TOTAL_STOCK} | Concurrent Users: ${TOTAL_USERS}\n`);

  // Setup
  const redis = new Redis({ host: 'localhost', port: 6379 });
  await redis.del(REDIS_KEYS.stock, REDIS_KEYS.purchases);
  await redis.set(REDIS_KEYS.stock, TOTAL_STOCK);

  const now = Date.now();
  saleConfig.startTime = now - 60000;
  saleConfig.endTime = now + 600000;
  saleConfig.totalStock = TOTAL_STOCK;

  const app = await buildApp({ logger: false, rateLimit: false });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  console.log(`Server started at ${address}\n`);

  // Phase 1: Fire all concurrent purchase requests
  console.log(`--- Phase 1: ${TOTAL_USERS} concurrent purchase attempts ---`);
  const startTime = performance.now();
  const latencies: number[] = [];

  const results = await Promise.allSettled(
    Array.from({ length: TOTAL_USERS }, async (_, i) => {
      const reqStart = performance.now();
      const res = await app.inject({
        method: 'POST',
        url: '/api/purchase',
        payload: { userId: `user-${i}` },
      });
      latencies.push(performance.now() - reqStart);
      return res;
    })
  );

  const totalTime = performance.now() - startTime;

  // Analyze results
  let successes = 0;
  let outOfStock = 0;
  let alreadyPurchased = 0;
  let errors = 0;

  for (const result of results) {
    if (result.status === 'rejected') {
      errors++;
      continue;
    }
    const body = result.value.json();
    if (result.value.statusCode === 201) successes++;
    else if (body.reason === 'OUT_OF_STOCK') outOfStock++;
    else if (body.reason === 'ALREADY_PURCHASED') alreadyPurchased++;
    else errors++;
  }

  // Latency stats
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`\nResults:`);
  console.log(`  Successes:          ${successes}`);
  console.log(`  Out of Stock:       ${outOfStock}`);
  console.log(`  Already Purchased:  ${alreadyPurchased}`);
  console.log(`  Errors:             ${errors}`);
  console.log(`\nPerformance:`);
  console.log(`  Total time:         ${totalTime.toFixed(0)}ms`);
  console.log(`  Throughput:         ${(TOTAL_USERS / (totalTime / 1000)).toFixed(0)} req/s`);
  console.log(`  Latency p50:        ${p50.toFixed(1)}ms`);
  console.log(`  Latency p95:        ${p95.toFixed(1)}ms`);
  console.log(`  Latency p99:        ${p99.toFixed(1)}ms`);

  // Verify Redis state
  const finalStock = await redis.get(REDIS_KEYS.stock);
  const purchaseCount = await redis.scard(REDIS_KEYS.purchases);

  console.log(`\nRedis State:`);
  console.log(`  Remaining stock:    ${finalStock}`);
  console.log(`  Purchase set size:  ${purchaseCount}`);

  // Assertions
  const pass = (label: string, condition: boolean) => {
    console.log(`  ${condition ? 'PASS' : 'FAIL'}: ${label}`);
    if (!condition) process.exitCode = 1;
  };

  console.log(`\nAssertions:`);
  pass(`Exactly ${TOTAL_STOCK} successful purchases`, successes === TOTAL_STOCK);
  pass(`Exactly ${TOTAL_USERS - TOTAL_STOCK} out-of-stock rejections`, outOfStock === TOTAL_USERS - TOTAL_STOCK);
  pass('Zero errors', errors === 0);
  pass('Stock is 0', parseInt(finalStock!, 10) === 0);
  pass(`Purchase set has ${TOTAL_STOCK} entries`, purchaseCount === TOTAL_STOCK);

  // Phase 2: Duplicate purchase attempts
  console.log(`\n--- Phase 2: ${TOTAL_USERS} duplicate purchase attempts ---`);
  const phase2Start = performance.now();

  const phase2Results = await Promise.allSettled(
    Array.from({ length: TOTAL_USERS }, async (_, i) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/purchase',
        payload: { userId: `user-${i}` },
      });
      return res;
    })
  );

  const phase2Time = performance.now() - phase2Start;

  let dupAlreadyPurchased = 0;
  let dupOutOfStock = 0;
  let dupErrors = 0;
  let dupSuccesses = 0;

  for (const result of phase2Results) {
    if (result.status === 'rejected') {
      dupErrors++;
      continue;
    }
    const body = result.value.json();
    if (result.value.statusCode === 201) dupSuccesses++;
    else if (body.reason === 'ALREADY_PURCHASED') dupAlreadyPurchased++;
    else if (body.reason === 'OUT_OF_STOCK') dupOutOfStock++;
    else dupErrors++;
  }

  console.log(`\nResults:`);
  console.log(`  Already Purchased:  ${dupAlreadyPurchased}`);
  console.log(`  Out of Stock:       ${dupOutOfStock}`);
  console.log(`  Successes:          ${dupSuccesses}`);
  console.log(`  Errors:             ${dupErrors}`);
  console.log(`  Time:               ${phase2Time.toFixed(0)}ms`);

  console.log(`\nAssertions:`);
  pass('No new successful purchases', dupSuccesses === 0);
  // With DECR/INCR pattern and stock=0, all requests hit OUT_OF_STOCK before
  // reaching the SADD duplicate check. This is correct — stock check is first.
  pass('All rejections are either OUT_OF_STOCK or ALREADY_PURCHASED', dupOutOfStock + dupAlreadyPurchased === TOTAL_USERS);
  pass('Zero errors', dupErrors === 0);

  // Verify stock unchanged
  const finalStock2 = await redis.get(REDIS_KEYS.stock);
  const purchaseCount2 = await redis.scard(REDIS_KEYS.purchases);
  pass('Stock still 0', parseInt(finalStock2!, 10) === 0);
  pass(`Purchase set still has ${TOTAL_STOCK} entries`, purchaseCount2 === TOTAL_STOCK);

  console.log(`\n=== Stress Test Complete ===`);

  await app.close();
  await redis.quit();
}

runStressTest().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
