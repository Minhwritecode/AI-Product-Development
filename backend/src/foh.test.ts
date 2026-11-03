import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('week 8 FOH availability and queue', () => {
  it('shares guest and host queue state without requiring guest auth', async () => {
    const app = buildApp();
    const status = await app.inject({ method: 'GET', url: '/api/v1/guest/front-door/status?branchId=branch_central' });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.estimatedWait).toMatchObject({ unit: 'MINUTES' });

    const payload = { branchId: 'branch_central', partySize: 3, timeBudgetMinutes: 45, language: 'en' as const, nickname: 'Family', notificationOptIn: false };
    const joined = await app.inject({ method: 'POST', url: '/api/v1/guest/queues', headers: { 'idempotency-key': 'guest-queue-001' }, payload });
    expect(joined.statusCode).toBe(201);
    // SAFETY: The successful response is asserted above and the public queue contract returns the fields used by this test.
    const queue = joined.json().data as { id: string; accessToken: string; status: string };
    expect(queue.status).toBe('WAITING');
    expect(queue.accessToken).toEqual(expect.any(String));

    const retry = await app.inject({ method: 'POST', url: '/api/v1/guest/queues', headers: { 'idempotency-key': 'guest-queue-001' }, payload });
    expect(retry.json().data.id).toBe(queue.id);

    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const hostQueue = await app.inject({ method: 'GET', url: '/api/v1/foh/queues?branchId=branch_central', headers: { authorization: `Bearer ${token}` } });
    expect(hostQueue.statusCode).toBe(200);
    expect(hostQueue.json().data).toEqual(expect.arrayContaining([expect.objectContaining({ id: queue.id, status: 'WAITING', accessToken: '' })]));

    const called = await app.inject({ method: 'POST', url: `/api/v1/foh/queues/${queue.id}/call`, headers: { authorization: `Bearer ${token}` } });
    expect(called.statusCode).toBe(200);
    expect(called.json().data.status).toBe('CALLED');

    const left = await app.inject({ method: 'POST', url: `/api/v1/guest/queues/${queue.id}/leave?accessToken=${encodeURIComponent(queue.accessToken)}`, headers: { 'idempotency-key': 'guest-queue-leave-001' } });
    expect(left.statusCode).toBe(200);
    expect(left.json().data.status).toBe('LEFT');
    await app.close();
  });

  it('enforces queue operating state and reservation transitions', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const auth = { authorization: `Bearer ${token}` };

    const paused = await app.inject({ method: 'PATCH', url: '/api/v1/branches/branch_central/operating-state', headers: auth, payload: { state: 'PAUSED', reason: 'Đang full vệ sinh khu vực' } });
    expect(paused.statusCode).toBe(200);
    expect(paused.json().data.operatingState).toBe('PAUSED');
    const blocked = await app.inject({ method: 'POST', url: '/api/v1/guest/queues', headers: { 'idempotency-key': 'guest-paused-001' }, payload: { branchId: 'branch_central', partySize: 2, timeBudgetMinutes: 30, language: 'vi' } });
    expect(blocked.statusCode).toBe(409);

    const reopened = await app.inject({ method: 'PATCH', url: '/api/v1/branches/branch_central/operating-state', headers: auth, payload: { state: 'OPEN', reason: 'Đã sẵn sàng đón khách' } });
    expect(reopened.statusCode).toBe(200);
    const reservation = await app.inject({ method: 'POST', url: '/api/v1/reservations', headers: { ...auth, 'idempotency-key': 'reservation-create-001' }, payload: { branchId: 'branch_central', partySize: 4, reservedFor: '2026-11-03T19:00:00.000Z', language: 'en', nickname: 'Tour group' } });
    expect(reservation.statusCode).toBe(201);
    const reservationId = String(reservation.json().data.id);
    const confirmed = await app.inject({ method: 'POST', url: `/api/v1/reservations/${reservationId}/confirm`, headers: { ...auth, 'idempotency-key': 'reservation-confirm-001' } });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().data.status).toBe('CONFIRMED');
    await app.close();
  });
});
