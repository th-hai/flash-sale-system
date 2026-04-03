import pg from 'pg';
import { dbConfig } from '../config.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDb(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      max: 20,
    });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Insert an order idempotently (ON CONFLICT DO NOTHING).
 * Returns true if a new row was inserted, false if it already existed.
 */
export async function insertOrder(userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.query(
    'INSERT INTO orders (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );
  return (result.rowCount ?? 0) > 0;
}
