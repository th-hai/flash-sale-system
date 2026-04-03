import type { SaleConfig } from './types/index.js';

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

// Default: sale starts in 1 minute and lasts 1 hour
const now = Date.now();

export const saleConfig: SaleConfig = {
  startTime: getEnvNumber('SALE_START_TIME', now + 60 * 1000),
  endTime: getEnvNumber('SALE_END_TIME', now + 61 * 60 * 1000),
  totalStock: getEnvNumber('SALE_TOTAL_STOCK', 100),
};

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: getEnvNumber('REDIS_PORT', 6379),
};

export const serverConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: getEnvNumber('PORT', 3000),
};

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: getEnvNumber('DB_PORT', 5432),
  database: process.env.DB_NAME || 'flashsale',
  user: process.env.DB_USER || 'flashsale',
  password: process.env.DB_PASSWORD || 'flashsale',
};
