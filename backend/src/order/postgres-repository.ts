import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Order, OrderRepository } from './types.js';
import { issueTableToken, verifyTableToken } from './table-token.js';

type OrderRow = { id: string; branch_id: string; service_session_id: string; status: Order['status']; round_number: number; course_policy: Order['coursePolicy'] };

type ItemRow = { id: string; name: string; price: string; currency: string; station_code: 'KITCHEN' | 'BAR'; status: string };

export function createPostgresOrderRepository(pool: pg.Pool, tokenSecret = 'luminex-local-development-secret'): OrderRepository {
  async function transaction<T>(key: string, command: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const previous = await client.query<{ response: T }>('SELECT response FROM guest_idempotency_records WHERE idempotency_key=$1 AND command=$2', [key, command]);

      if (previous.rowCount) { await client.query('COMMIT');

 return previous.rows[0].response; }

      const result = await work(client);
      await client.query('INSERT INTO guest_idempotency_records(idempotency_key,command,response) VALUES($1,$2,$3)', [key, command, JSON.stringify(result)]);
      await client.query('COMMIT');

      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async function readOrder(client: pg.PoolClient, id: string): Promise<Order> {
    const found = await client.query<OrderRow>('SELECT id,branch_id,service_session_id,status,round_number,course_policy FROM orders WHERE id=$1', [id]);
    assert(found.rowCount, 'NOT_FOUND', 'Order not found', 404);
    const lines = await client.query<{ menu_item_id: string; item_name: string; unit_price: string; currency: string; quantity: number; modifiers: string[]; allergen_note: string | null; guest_note: string | null; station_code: 'KITCHEN' | 'BAR' }>('SELECT menu_item_id,item_name,unit_price,currency,quantity,modifiers,allergen_note,guest_note,station_code FROM order_lines WHERE order_id=$1 ORDER BY id', [id]);
    const row = found.rows[0];

    return { id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, roundNumber: row.round_number, coursePolicy: row.course_policy, lines: lines.rows.map((line) => ({ menuItemId: line.menu_item_id, quantity: line.quantity, modifierOptionIds: line.modifiers, allergenNote: line.allergen_note ?? undefined, guestNote: line.guest_note ?? undefined, itemName: line.item_name, unitPrice: Number(line.unit_price), currency: line.currency, stationCode: line.station_code })) };
  }

  return {
    async createDraft(actor, input, key, requestId) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId);
      assert(input.lines.length > 0, 'VALIDATION_ERROR', 'At least one order line is required');

      return transaction(key, 'ORDER_DRAFT', async (client) => {
        const session = await client.query<{ branch_id: string; status: string }>('SELECT branch_id,status FROM service_sessions WHERE id=$1 FOR UPDATE', [input.serviceSessionId]);
        assert(session.rowCount && session.rows[0].branch_id === input.branchId && session.rows[0].status === 'ACTIVE', 'CONFLICT', 'Service session is not active', 409);
        const orderId = `order_${randomUUID()}`;
        const round = await client.query<{ value: string }>('SELECT COALESCE(MAX(round_number),0)::text AS value FROM orders WHERE service_session_id=$1', [input.serviceSessionId]);
        await client.query('INSERT INTO orders(id,branch_id,service_session_id,round_number,course_policy,created_by) VALUES($1,$2,$3,$4,$5,$6)', [orderId,input.branchId,input.serviceSessionId,Number(round.rows[0].value)+1,input.coursePolicy,actor.id]);

        for (const line of input.lines) {
          assert(line.quantity > 0, 'VALIDATION_ERROR', 'Quantity must be positive');
          const item = await client.query<ItemRow>('SELECT mi.id,mi.name,mi.price,mi.currency,mi.station_code,mi.status FROM menu_items mi JOIN branches b ON b.restaurant_id=mi.restaurant_id WHERE mi.id=$1 AND b.id=$2 FOR UPDATE', [line.menuItemId,input.branchId]);
          assert(item.rowCount && item.rows[0].status === 'PUBLISHED', 'ITEM_UNAVAILABLE', 'Menu item is unavailable', 409);
          const selected = item.rows[0];
          await client.query('INSERT INTO order_lines(id,order_id,menu_item_id,item_name,unit_price,currency,quantity,modifiers,allergen_note,guest_note,station_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [`order_line_${randomUUID()}`,orderId,selected.id,selected.name,selected.price,selected.currency,line.quantity,JSON.stringify(line.modifierOptionIds ?? []),line.allergenNote ?? null,line.guestNote ?? null,selected.station_code]);
        }

        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [input.branchId,actor.id,'ORDER_DRAFT','ORDER',orderId,requestId]);

        return readOrder(client, orderId);
      });
    },
    async send(actor, orderId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transaction(key, 'ORDER_SEND', async (client) => {
        const found = await client.query<OrderRow>('SELECT id,branch_id,service_session_id,status,round_number,course_policy FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
        assert(found.rowCount, 'NOT_FOUND', 'Order not found', 404); assertBranchScope(actor, found.rows[0].branch_id); assert(found.rows[0].status === 'DRAFT', 'CONFLICT', 'Only draft orders can be sent', 409);
        await client.query('UPDATE orders SET status=$2,sent_at=now() WHERE id=$1', [orderId,'SENT']);
        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [found.rows[0].branch_id,actor.id,'ORDER_SENT','ORDER',orderId,requestId]);

        return readOrder(client, orderId);
      });
    }
    ,
    async issueTableToken(actor, tableId) {
      assertPermission(actor, 'queue:write');
      const found = await pool.query<{ branch_id: string; qr_token_version: number }>('SELECT a.branch_id,t.qr_token_version FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE t.id=$1', [tableId]);
      assert(found.rowCount, 'NOT_FOUND', 'Table not found', 404); assertBranchScope(actor, found.rows[0].branch_id);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60_000);

      return { token: issueTableToken({ tableId, branchId: found.rows[0].branch_id, version: found.rows[0].qr_token_version, expiresAt: expiresAt.getTime() }, tokenSecret), expiresAt: expiresAt.toISOString() };
    },
    async guestMenu(token) {
      const payload = verifyTableToken(token, tokenSecret);
      const table = await pool.query<{ id: string; label: string; qr_token_version: number }>('SELECT t.id,t.label,t.qr_token_version FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE t.id=$1 AND a.branch_id=$2', [payload.tableId,payload.branchId]);
      assert(table.rowCount && table.rows[0].qr_token_version === payload.version, 'UNAUTHENTICATED', 'Table QR is invalid', 401);
      const session = await pool.query<{ id: string }>('SELECT id FROM service_sessions WHERE table_id=$1 AND branch_id=$2 AND status=$3', [payload.tableId,payload.branchId,'ACTIVE']);
      assert(session.rowCount, 'CONFLICT', 'There is no active table session', 409);
      const items = await pool.query<{ id: string; name: string; description: string; price: string; currency: string; allergen_codes: string[]; station_code: 'KITCHEN' | 'BAR' }>('SELECT mi.id,mi.name,mi.description,mi.price,mi.currency,mi.allergen_codes,mi.station_code FROM menu_items mi JOIN branches b ON b.restaurant_id=mi.restaurant_id WHERE b.id=$1 AND mi.status=$2 ORDER BY mi.name', [payload.branchId,'PUBLISHED']);

      return { branchId: payload.branchId, tableId: payload.tableId, tableLabel: table.rows[0].label, serviceSessionId: session.rows[0].id, items: items.rows.map((item) => ({ id: item.id, name: item.name, description: item.description, price: Number(item.price), currency: item.currency, allergenCodes: item.allergen_codes, stationCode: item.station_code })) };
    },
    async submitGuestRequest(token, lines, key) {
      assert(lines.length > 0, 'VALIDATION_ERROR', 'At least one request line is required');
      const guest = await this.guestMenu(token);

      return transaction(key, 'GUEST_ADD_ON', async (client) => {
        const id = `request_${randomUUID()}`;
        const created = await client.query<{ id: string; branch_id: string; service_session_id: string; status: 'SUBMITTED'; payload: { lines: import('./types.js').OrderLineInput[] }; created_at: Date }>('INSERT INTO foh_requests(id,branch_id,service_session_id,payload) VALUES($1,$2,$3,$4) RETURNING id,branch_id,service_session_id,status,payload,created_at', [id,guest.branchId,guest.serviceSessionId,JSON.stringify({ lines })]);
        const row = created.rows[0];

 return { id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, lines: row.payload.lines, createdAt: row.created_at.toISOString() };
      });
    },
    async listRequests(actor, branchId) {
      assertPermission(actor, 'queue:read'); assertBranchScope(actor, branchId);
      const rows = await pool.query<{ id: string; branch_id: string; service_session_id: string; status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COMPLETED'; payload: { lines: import('./types.js').OrderLineInput[] }; created_at: Date }>('SELECT id,branch_id,service_session_id,status,payload,created_at FROM foh_requests WHERE branch_id=$1 ORDER BY created_at DESC', [branchId]);

      return rows.rows.map((row) => ({ id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, lines: row.payload.lines, createdAt: row.created_at.toISOString() }));
    },
    async commandRequest(actor, requestId, command, key, auditRequestId) {
      assertPermission(actor, 'queue:write');

      return transaction(key, `FOH_REQUEST_${command.toUpperCase()}`, async (client) => {
        const found = await client.query<{ id: string; branch_id: string; service_session_id: string; status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COMPLETED'; payload: { lines: import('./types.js').OrderLineInput[] }; created_at: Date }>('SELECT id,branch_id,service_session_id,status,payload,created_at FROM foh_requests WHERE id=$1 FOR UPDATE', [requestId]);
        assert(found.rowCount, 'NOT_FOUND', 'FOH request not found', 404); const current = found.rows[0]; assertBranchScope(actor, current.branch_id);
        const status = command === 'acknowledge' ? 'ACKNOWLEDGED' : command === 'reject' ? 'REJECTED' : 'COMPLETED';
        assert(current.status === 'SUBMITTED' || current.status === 'ACKNOWLEDGED' && command === 'complete', 'CONFLICT', 'Request cannot transition', 409);
        const updated = await client.query<{ id: string; branch_id: string; service_session_id: string; status: typeof status; payload: { lines: import('./types.js').OrderLineInput[] }; created_at: Date }>('UPDATE foh_requests SET status=$2,acknowledged_by=CASE WHEN $2=$3 THEN $4 ELSE acknowledged_by END,acknowledged_at=CASE WHEN $2=$3 THEN now() ELSE acknowledged_at END WHERE id=$1 RETURNING id,branch_id,service_session_id,status,payload,created_at', [requestId,status,'ACKNOWLEDGED',actor.id]);
        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [current.branch_id,actor.id,`FOH_REQUEST_${command.toUpperCase()}`,'FOH_REQUEST',requestId,auditRequestId]);
        const row = updated.rows[0];

 return { id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, lines: row.payload.lines, createdAt: row.created_at.toISOString() };
      });
    }
  };
}
