import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('requires managed PostgreSQL in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(32) })).toThrow('DATABASE_URL');
  });

  it('loads cloud TLS settings without exposing credentials', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      DATABASE_URL: 'postgresql://user:password@managed.example/luminex',
      DATABASE_SSL: 'true',
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false'
    });

    expect(config.databaseUrl).toBe('postgresql://user:password@managed.example/luminex');
    expect(config.databaseSsl).toBe(true);
    expect(config.databaseSslRejectUnauthorized).toBe(false);
  });
});
