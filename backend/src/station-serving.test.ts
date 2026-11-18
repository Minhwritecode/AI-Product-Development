import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('weeks 11–12 station execution and serving flow', () => {
  it('routes items to Kitchen and Bar, and executes preparation through serving lifecycle', async () => {
    const app = buildApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@luminex.local', password: 'luminex-demo' }
    });

    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };

    // 1. Seat table and create order with Kitchen + Bar lines
    const seated = await app.inject({
      method: 'POST',
      url: '/api/v1/service-sessions',
      headers: { ...headers, 'idempotency-key': 'kds-seat-001' },
      payload: { branchId: 'branch_central', tableId: 'table_01', partySize: 2, sourceType: 'WALK_IN' }
    });

    expect(seated.statusCode).toBe(201);
    const sessionId = String(seated.json().data.id);

    const draft = await app.inject({
      method: 'POST',
      url: `/api/v1/service-sessions/${sessionId}/orders`,
      headers: { ...headers, 'idempotency-key': 'kds-order-001' },
      payload: {
        branchId: 'branch_central',
        coursePolicy: 'AS_READY',
        lines: [
          { menuItemId: 'item_chicken', quantity: 2, guestNote: 'Chín kỹ' },
          { menuItemId: 'item_coffee', quantity: 1, guestNote: 'Ít đường' }
        ]
      }
    });

    expect(draft.statusCode).toBe(201);
    const orderId = String(draft.json().data.id);

    // 2. Send order -> routes food to KITCHEN and drink to BAR
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${orderId}/send`,
      headers: { ...headers, 'idempotency-key': 'kds-send-001' }
    });

    expect(sent.statusCode).toBe(200);
    expect(sent.json().data.status).toBe('SENT');

    // 3. Station isolation: Kitchen only sees KITCHEN tickets
    const kitchenTickets = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/KITCHEN/tickets?branchId=branch_central',
      headers
    });

    expect(kitchenTickets.statusCode).toBe(200);
    // SAFETY: Verified response structure matches StationTicket envelope in test.
    const kitchenList = kitchenTickets.json().data as Array<{ id: string; stationCode: string; lines: Array<{ itemName: string }> }>;
    expect(kitchenList.length).toBeGreaterThan(0);
    expect(kitchenList.every((t) => t.stationCode === 'KITCHEN')).toBe(true);

    const barTickets = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/BAR/tickets?branchId=branch_central',
      headers
    });

    expect(barTickets.statusCode).toBe(200);
    // SAFETY: Verified response structure matches StationTicket envelope in test.
    const barList = barTickets.json().data as Array<{ id: string; stationCode: string }>;
    expect(barList.length).toBeGreaterThan(0);
    expect(barList.every((t) => t.stationCode === 'BAR')).toBe(true);

    const kitchenTicketId = kitchenList[0].id;

    // 4. Kitchen accepts ticket: NEW -> ACCEPTED
    const accept = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${kitchenTicketId}/accept`,
      headers: { ...headers, 'idempotency-key': 'ticket-accept-001' }
    });

    expect(accept.statusCode).toBe(200);
    expect(accept.json().data.status).toBe('ACCEPTED');

    // 5. Kitchen starts preparation: ACCEPTED -> PREPARING
    const start = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${kitchenTicketId}/start`,
      headers: { ...headers, 'idempotency-key': 'ticket-start-001' }
    });

    expect(start.statusCode).toBe(200);
    expect(start.json().data.status).toBe('PREPARING');

    // 6. Kitchen marks ready: PREPARING -> READY
    const ready = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${kitchenTicketId}/ready`,
      headers: { ...headers, 'idempotency-key': 'ticket-ready-001' }
    });

    expect(ready.statusCode).toBe(200);
    expect(ready.json().data.status).toBe('READY');

    // 7. Server checks serving queue on floor -> sees ready ticket
    const queue = await app.inject({
      method: 'GET',
      url: '/api/v1/branches/branch_central/serving-queue',
      headers
    });

    expect(queue.statusCode).toBe(200);
    // SAFETY: Verified response structure matches StationTicket array envelope in test.
    const readyList = queue.json().data as Array<{ id: string; status: string }>;
    expect(readyList.some((t) => t.id === kitchenTicketId)).toBe(true);

    // 8. Server picks up: READY -> PICKED_UP
    const pickup = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${kitchenTicketId}/pick-up`,
      headers: { ...headers, 'idempotency-key': 'ticket-pickup-001' }
    });

    expect(pickup.statusCode).toBe(200);
    expect(pickup.json().data.status).toBe('PICKED_UP');

    // 9. Server serves: PICKED_UP -> SERVED
    const serve = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${kitchenTicketId}/serve`,
      headers: { ...headers, 'idempotency-key': 'ticket-serve-001' }
    });

    expect(serve.statusCode).toBe(200);
    expect(serve.json().data.status).toBe('SERVED');

    await app.close();
  });

  it('supports station delay and rejection with reason', async () => {
    const app = buildApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@luminex.local', password: 'luminex-demo' }
    });

    const token = String(login.json().data.token);
    const headers = { authorization: `Bearer ${token}` };

    const seated = await app.inject({
      method: 'POST',
      url: '/api/v1/service-sessions',
      headers: { ...headers, 'idempotency-key': 'kds-seat-002' },
      payload: { branchId: 'branch_central', tableId: 'table_02', partySize: 2, sourceType: 'WALK_IN' }
    });

    const sessionId = String(seated.json().data.id);

    const draft = await app.inject({
      method: 'POST',
      url: `/api/v1/service-sessions/${sessionId}/orders`,
      headers: { ...headers, 'idempotency-key': 'kds-order-002' },
      payload: {
        branchId: 'branch_central',
        coursePolicy: 'SERVE_TOGETHER',
        lines: [{ menuItemId: 'item_coffee', quantity: 1 }]
      }
    });

    const orderId = String(draft.json().data.id);

    await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${orderId}/send`,
      headers: { ...headers, 'idempotency-key': 'kds-send-002' }
    });

    const barTickets = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/BAR/tickets?branchId=branch_central',
      headers
    });

    // SAFETY: Verified response structure matches StationTicket envelope in test.
    const barList = barTickets.json().data as Array<{ id: string }>;
    const barTicketId = barList[0].id;

    // Delay with reason
    const delay = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${barTicketId}/delay`,
      headers: { ...headers, 'idempotency-key': 'ticket-delay-001' },
      payload: { reason: 'Máy pha cà phê đang vệ sinh áp suất' }
    });

    expect(delay.statusCode).toBe(200);
    expect(delay.json().data.status).toBe('DELAYED');
    expect(delay.json().data.delayReason).toBe('Máy pha cà phê đang vệ sinh áp suất');

    // Reject with reason
    const reject = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${barTicketId}/reject`,
      headers: { ...headers, 'idempotency-key': 'ticket-reject-001' },
      payload: { reason: 'Hết hạt Robusta rang đậm' }
    });

    expect(reject.statusCode).toBe(200);
    expect(reject.json().data.status).toBe('REJECTED');
    expect(reject.json().data.rejectReason).toBe('Hết hạt Robusta rang đậm');

    await app.close();
  });
});
