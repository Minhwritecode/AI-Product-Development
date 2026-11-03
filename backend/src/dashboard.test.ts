import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('week 7 dashboard and reconciliation', () => {
  it('exposes branch-scoped low stock, discrepancy and audit source records', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };

    const dashboard = await app.inject({ method: 'GET', url: '/api/v1/dashboard/summary?branchId=branch_central', headers });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().data.freshness).toBe('FRESH');
    expect(dashboard.json().data.lowStock).toEqual(expect.arrayContaining([expect.objectContaining({ ingredientId: 'ingredient_chicken', status: 'LOW' })]));
    expect(dashboard.json().data.summary.incompleteTheoryCount.value).toBe(0);

    const reconciliation = await app.inject({ method: 'GET', url: '/api/v1/reconciliation/inventory?branchId=branch_central', headers });
    expect(reconciliation.statusCode).toBe(200);
    expect(reconciliation.json().data.items).toEqual(expect.arrayContaining([expect.objectContaining({ ingredientId: 'ingredient_chicken' })]));

    const audit = await app.inject({ method: 'GET', url: '/api/v1/audit/logs?branchId=branch_central&limit=10', headers });
    expect(audit.statusCode).toBe(200);
    expect(Array.isArray(audit.json().data)).toBe(true);
    await app.close();
  });
});
