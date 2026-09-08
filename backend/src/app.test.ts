import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('health endpoints', () => {
  it('returns a healthy response', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    await app.close();
  });
});
