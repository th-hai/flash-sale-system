export const REDIS_KEYS = {
  stock: 'sale:stock',
  userLock: (userId: string) => `sale:lock:${userId}`,
} as const;
