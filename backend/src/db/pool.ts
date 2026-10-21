import pg from 'pg';

const { Pool } = pg;

export type DatabasePoolOptions = {
  ssl?: boolean;
  rejectUnauthorized?: boolean;
};

export function createPool(databaseUrl: string, options: DatabasePoolOptions = {}): pg.Pool {
  const ssl = options.ssl ?? true;
  const rejectUnauthorized = options.rejectUnauthorized ?? true;

  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 10_000,
    ssl: ssl ? { rejectUnauthorized } : false
  });
}

export async function checkDatabase(pool: pg.Pool): Promise<'ok' | 'unavailable'> {
  try {
    await pool.query('SELECT 1');

    return 'ok';
  } catch {
    return 'unavailable';
  }
}
