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

  it('does not report readiness when PostgreSQL is not configured', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ data: { status: 'degraded', dependencies: { postgres: 'not-configured' } } });
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

  it('exposes the week 3 staff workspace and task state machine', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    // SAFETY: The route returns data.token after the demo credentials succeed.
    const token = String(login.json().data.token);
    const workspace = await app.inject({ method: 'GET', url: '/api/v1/operations/workspace?branchId=branch_central', headers: { authorization: `Bearer ${token}` } });
    expect(workspace.statusCode).toBe(200);
    expect(workspace.json().data.staff).toHaveLength(4);
    expect(workspace.json().data.tasks).toHaveLength(2);
    expect(workspace.json().data.stationAssignments).toHaveLength(4);

    const resolved = await app.inject({ method: 'POST', url: '/api/v1/operational-tasks/task_count/resolve', headers: { authorization: `Bearer ${token}` }, payload: { note: 'Đã kiểm tra lại số lượng tại quầy bar.' } });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().data.status).toBe('RESOLVED');
    await app.close();
  });

  it('supports branch-scoped station assignment and auditable task handover', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const staff = await app.inject({ method: 'POST', url: '/api/v1/staff', headers: { authorization: `Bearer ${token}` }, payload: { branchId: 'branch_central', displayName: 'Host Backup', email: 'host.backup@luminex.local', roleCodes: ['HOST'], stationAssignments: [{ roleCode: 'HOST', stationCode: 'FRONT_DESK_BACKUP' }] } });
    expect(staff.statusCode).toBe(201);
    const handover = await app.inject({ method: 'POST', url: '/api/v1/operational-tasks/task_queue/handover', headers: { authorization: `Bearer ${token}` }, payload: { ownerId: staff.json().data.id, stationCode: 'FRONT_DESK_BACKUP', note: 'Chuyển task cho host dự phòng trong giờ cao điểm.' } });
    expect(handover.statusCode).toBe(200);
    expect(handover.json().data.status).toBe('IN_PROGRESS');
    expect(handover.json().data.ownerId).toBe(staff.json().data.id);
    await app.close();
  });

  it('validates week 4 ingredient conversion and exposes master data', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    // SAFETY: The route returns data.token after the demo credentials succeed.
    const token = String(login.json().data.token);
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/ingredients', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Ớt', purchaseUnit: 'kg', stockUnit: 'g', purchaseToStock: 0, standardCost: 1000 } });
    expect(invalid.statusCode).toBe(422);
    const overview = await app.inject({ method: 'GET', url: '/api/v1/master-data/overview?branchId=branch_central', headers: { authorization: `Bearer ${token}` } });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data.menuItems).toHaveLength(2);
    expect(overview.json().data.recipes[0].lines.length).toBeGreaterThan(0);
    expect(overview.json().data.units.map((unit: { code: string }) => unit.code)).toContain('kg');
    expect(overview.json().data.allergens.map((allergen: { code: string }) => allergen.code)).toContain('MILK');
    await app.close();
  });

  it('keeps week 4 menu version, modifier, allergen and availability commands explicit', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const version = await app.inject({ method: 'POST', url: '/api/v1/menu/versions', headers: { authorization: `Bearer ${token}` }, payload: { menuItemId: 'item_chicken', price: 195000, effectiveFrom: '2026-11-01T00:00:00.000Z' } });
    expect(version.statusCode).toBe(201);
    expect(version.json().data.status).toBe('DRAFT');
    const modifier = await app.inject({ method: 'POST', url: '/api/v1/menu/modifier-groups', headers: { authorization: `Bearer ${token}` }, payload: { menuItemId: 'item_chicken', name: 'Độ cay', required: false, options: [{ label: 'Không cay' }, { label: 'Cay vừa', priceDelta: 5000 }] } });
    expect(modifier.statusCode).toBe(201);
    const allergens = await app.inject({ method: 'POST', url: '/api/v1/menu/items/item_chicken/allergens', headers: { authorization: `Bearer ${token}` }, payload: { allergenCodes: ['GLUTEN'] } });
    expect(allergens.statusCode).toBe(200);
    expect(allergens.json().data.allergenCodes).toEqual(['GLUTEN']);
    const unavailable = await app.inject({ method: 'POST', url: '/api/v1/menu/items/item_chicken/availability', headers: { authorization: `Bearer ${token}` }, payload: { status: 'UNAVAILABLE' } });
    expect(unavailable.statusCode).toBe(200);
    expect(unavailable.json().data.status).toBe('UNAVAILABLE');
    await app.close();
  });
});
