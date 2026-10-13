import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('health endpoints', () => {
  it('returns a healthy response', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: { status: 'ok' }, meta: { requestId: expect.any(String) } });
    await app.close();
  });

  it('supports demo auth and protects setup data', async () => {
    const app = buildApp();
    const unauthorized = await app.inject({ method: 'GET', url: '/api/v1/setup/overview' });
    expect(unauthorized.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@luminex.local', password: 'luminex-demo' }
    });

    expect(login.statusCode).toBe(200);
    // SAFETY: The successful login response is asserted immediately above and the route contract returns data.token.
    const token = String(login.json().data.token);
    const setup = await app.inject({ method: 'GET', url: '/api/v1/setup/overview', headers: { authorization: `Bearer ${token}` } });
    expect(setup.statusCode).toBe(200);
    expect(setup.json().data.branches[0].areas[0].tables).toHaveLength(3);

    const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { authorization: `Bearer ${token}` } });
    expect(logout.statusCode).toBe(200);
    const afterLogout = await app.inject({ method: 'GET', url: '/api/v1/setup/overview', headers: { authorization: `Bearer ${token}` } });
    expect(afterLogout.statusCode).toBe(401);
    await app.close();
  });

  it('enforces branch scope on setup mutations', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    // SAFETY: The successful login response is asserted by the protected request below.
    const token = String(login.json().data.token);
    const response = await app.inject({ method: 'POST', url: '/api/v1/areas/missing/tables', headers: { authorization: `Bearer ${token}` }, payload: { label: 'T99', capacity: 2 } });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });
});
