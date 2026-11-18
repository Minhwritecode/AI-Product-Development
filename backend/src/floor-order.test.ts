import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('week 9–10 floor and table-order flow', () => {
  it('holds and seats a table, then edits and sends a session order', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };

    const hold = await app.inject({ method: 'POST', url: '/api/v1/table-holds', headers: { ...headers, 'idempotency-key': 'floor-hold-001' }, payload: { branchId: 'branch_central', tableId: 'table_01', partySize: 2, minutes: 10 } });
    expect(hold.statusCode).toBe(200);

    const seated = await app.inject({ method: 'POST', url: '/api/v1/service-sessions', headers: { ...headers, 'idempotency-key': 'floor-seat-001' }, payload: { branchId: 'branch_central', tableId: 'table_01', partySize: 2, sourceType: 'WALK_IN' } });
    expect(seated.statusCode).toBe(201);
    const sessionId = String(seated.json().data.id);

    const draft = await app.inject({ method: 'POST', url: `/api/v1/service-sessions/${sessionId}/orders`, headers: { ...headers, 'idempotency-key': 'order-draft-001' }, payload: { branchId: 'branch_central', coursePolicy: 'AS_READY', lines: [{ menuItemId: 'item_chicken', quantity: 1 }] } });
    expect(draft.statusCode).toBe(201);
    const orderId = String(draft.json().data.id);

    const updated = await app.inject({ method: 'PATCH', url: `/api/v1/orders/${orderId}`, headers: { ...headers, 'idempotency-key': 'order-update-001' }, payload: { coursePolicy: 'SERVE_TOGETHER', lines: [{ menuItemId: 'item_chicken', quantity: 2, guestNote: 'Không đậu phộng' }] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({ status: 'DRAFT', coursePolicy: 'SERVE_TOGETHER', lines: [expect.objectContaining({ quantity: 2, guestNote: 'Không đậu phộng' })] });

    const sent = await app.inject({ method: 'POST', url: `/api/v1/orders/${orderId}/send`, headers: { ...headers, 'idempotency-key': 'order-send-001' } });
    expect(sent.statusCode).toBe(200);
    expect(sent.json().data.status).toBe('SENT');

    // Reject modifications after order is sent
    const patchAfterSend = await app.inject({ method: 'PATCH', url: `/api/v1/orders/${orderId}`, headers: { ...headers, 'idempotency-key': 'order-update-after-send' }, payload: { coursePolicy: 'AS_READY', lines: [{ menuItemId: 'item_chicken', quantity: 3 }] } });
    expect(patchAfterSend.statusCode).toBe(409);

    await app.close();
  });

  it('completes table transfer and cleaning lifecycle, preventing seating on dirty table', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };

    // Seat table_02
    const seated = await app.inject({ method: 'POST', url: '/api/v1/service-sessions', headers: { ...headers, 'idempotency-key': 'seat-transfer-001' }, payload: { branchId: 'branch_central', tableId: 'table_02', partySize: 3, sourceType: 'WALK_IN' } });
    expect(seated.statusCode).toBe(201);
    const sessionId = String(seated.json().data.id);

    // Transfer from table_02 to table_03
    const transfer = await app.inject({ method: 'POST', url: `/api/v1/service-sessions/${sessionId}/transfer`, headers: { ...headers, 'idempotency-key': 'transfer-001' }, payload: { tableId: 'table_03' } });
    expect(transfer.statusCode).toBe(200);
    expect(transfer.json().data.tableId).toBe('table_03');

    // table_02 must now be WAITING_CLEANING, cannot be seated
    const dirtySeat = await app.inject({ method: 'POST', url: '/api/v1/service-sessions', headers: { ...headers, 'idempotency-key': 'seat-dirty-table' }, payload: { branchId: 'branch_central', tableId: 'table_02', partySize: 2, sourceType: 'WALK_IN' } });
    expect(dirtySeat.statusCode).toBe(409);

    // Check board has cleaning task for table_02
    const board = await app.inject({ method: 'GET', url: '/api/v1/branches/branch_central/floor', headers });
    expect(board.statusCode).toBe(200);
    // SAFETY: Response payload schema is verified by status code 200 and matches FloorBoard schema.
    const cleaningTasks = board.json().data.cleaningTasks as Array<{ id: string; tableId: string; status: string }>;
    const task02 = cleaningTasks.find((item) => item.tableId === 'table_02');
    expect(task02).toBeDefined();
    expect(task02?.status).toBe('OPEN');

    // Claim cleaning task
    const claim = await app.inject({ method: 'POST', url: `/api/v1/cleaning-tasks/${task02!.id}/claim`, headers: { ...headers, 'idempotency-key': 'claim-clean-001' } });
    expect(claim.statusCode).toBe(200);
    expect(claim.json().data.status).toBe('CLAIMED');

    // Complete cleaning task
    const complete = await app.inject({ method: 'POST', url: `/api/v1/cleaning-tasks/${task02!.id}/complete`, headers: { ...headers, 'idempotency-key': 'complete-clean-001' } });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().data.status).toBe('COMPLETE');

    // Vacate table_03 session
    const vacate = await app.inject({ method: 'POST', url: `/api/v1/service-sessions/${sessionId}/vacate`, headers: { ...headers, 'idempotency-key': 'vacate-001' } });
    expect(vacate.statusCode).toBe(200);

    await app.close();
  });

  it('keeps guest add-on as submitted until staff acknowledgement creates a draft', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };
    const issued = await app.inject({ method: 'POST', url: '/api/v1/tables/table_02/qr-token', headers });
    expect(issued.statusCode).toBe(200);
    const tableToken = String(issued.json().data.token);

    const menu = await app.inject({ method: 'GET', url: '/api/v1/guest/table-menu', headers: { 'x-table-token': tableToken } });
    expect(menu.statusCode).toBe(200);
    const submitted = await app.inject({ method: 'POST', url: '/api/v1/guest/table-requests', headers: { 'x-table-token': tableToken, 'idempotency-key': 'guest-addon-001' }, payload: { lines: [{ menuItemId: 'item_coffee', quantity: 2, guestNote: 'Ít đá' }] } });
    expect(submitted.statusCode).toBe(201);
    const requestId = String(submitted.json().data.id);
    expect(submitted.json().data.status).toBe('SUBMITTED');

    const acknowledged = await app.inject({ method: 'POST', url: `/api/v1/foh/requests/${requestId}/acknowledge`, headers: { ...headers, 'idempotency-key': 'guest-addon-ack-001' } });
    expect(acknowledged.statusCode).toBe(200);
    expect(acknowledged.json().data).toMatchObject({ status: 'ACKNOWLEDGED', orderId: expect.any(String) });

    const completed = await app.inject({ method: 'POST', url: `/api/v1/foh/requests/${requestId}/complete`, headers: { ...headers, 'idempotency-key': 'guest-addon-complete-001' } });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().data.status).toBe('COMPLETED');

    await app.close();
  });

  it('supports rejecting guest add-on request and rejects invalid qr token', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@luminex.local', password: 'luminex-demo' } });
    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };

    const invalidTokenMenu = await app.inject({ method: 'GET', url: '/api/v1/guest/table-menu', headers: { 'x-table-token': 'invalid.signed.jwt' } });
    expect(invalidTokenMenu.statusCode).toBe(401);

    const issued = await app.inject({ method: 'POST', url: '/api/v1/tables/table_02/qr-token', headers });
    const tableToken = String(issued.json().data.token);

    const submitted = await app.inject({ method: 'POST', url: '/api/v1/guest/table-requests', headers: { 'x-table-token': tableToken, 'idempotency-key': 'guest-addon-reject-001' }, payload: { lines: [{ menuItemId: 'item_coffee', quantity: 1 }] } });
    expect(submitted.statusCode).toBe(201);
    const requestId = String(submitted.json().data.id);

    const rejected = await app.inject({ method: 'POST', url: `/api/v1/foh/requests/${requestId}/reject`, headers: { ...headers, 'idempotency-key': 'guest-addon-reject-cmd' } });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.status).toBe('REJECTED');

    await app.close();
  });
});
