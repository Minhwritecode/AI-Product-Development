import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required for db:migrate');

const pool = createPool(databaseUrl, {
  ssl: process.env.DATABASE_SSL !== 'false',
  rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
});

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);

    if (applied.rowCount) continue;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(await readFile(join(migrationDirectory, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
