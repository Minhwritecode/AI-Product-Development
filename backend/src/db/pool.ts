import pg from 'pg';

const { Pool } = pg;

export function createPool(databaseUrl: string): pg.Pool {
  return new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 10_000 });
}

export async function checkDatabase(pool: pg.Pool): Promise<'ok' | 'unavailable'> {
  try {
    await pool.query('SELECT 1');

    return 'ok';
  } catch {
    return 'unavailable';
  }
}
