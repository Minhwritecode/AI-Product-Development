import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { checkDatabase, createPool } from './db/pool.js';
import { createPostgresRepository } from './platform/postgres-repository.js';
import { createPostgresOperationsRepository } from './operations/postgres-repository.js';

const config = loadConfig();

const pool = config.databaseUrl
  ? createPool(config.databaseUrl, {
      ssl: config.databaseSsl,
      rejectUnauthorized: config.databaseSslRejectUnauthorized
    })
  : undefined;

const app = buildApp({
  repository: pool ? createPostgresRepository(pool) : undefined,
  operationsRepository: pool ? createPostgresOperationsRepository(pool) : undefined,
  jwtSecret: config.jwtSecret,
  databaseStatus: async () => (pool ? checkDatabase(pool) : 'not-configured')
});

const port = config.port;

try {
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  await pool?.end();
  process.exit(1);
}

const shutdown = async () => {
  await app.close();
  await pool?.end();
};

process.once('SIGINT', shutdown);

process.once('SIGTERM', shutdown);
