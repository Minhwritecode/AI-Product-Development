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

      if (previous.rowCount) {
        await client.query('COMMIT');

        return previous.rows[0].response;
      }

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

  async function writeLines(client: pg.PoolClient, orderId: string, branchId: string, lines: import('./types.js').OrderLineInput[]) {
    assert(lines.length > 0, 'VALIDATION_ERROR', 'At least one order line is required');

    for (const line of lines) {
      assert(Number.isInteger(line.quantity) && line.quantity > 0, 'VALIDATION_ERROR', 'Quantity must be a positive integer');
      const item = await client.query<ItemRow>('SELECT mi.id,mi.name,mi.price,mi.currency,mi.station_code,mi.status FROM menu_items mi JOIN branches b ON b.restaurant_id=mi.restaurant_id WHERE mi.id=$1 AND b.id=$2 FOR UPDATE', [line.menuItemId, branchId]);
      assert(item.rowCount && item.rows[0].status === 'PUBLISHED', 'ITEM_UNAVAILABLE', 'Menu item is unavailable', 409);
      const modifierIds = [...new Set(line.modifierOptionIds ?? [])];

      if (modifierIds.length) {
        const valid = await client.query<{ id: string }>('SELECT mo.id FROM modifier_options mo JOIN modifier_groups mg ON mg.id=mo.modifier_group_id WHERE mg.menu_item_id=$1 AND mo.id=ANY($2::text[])', [line.menuItemId, modifierIds]);
        assert(valid.rowCount === modifierIds.length, 'VALIDATION_ERROR', 'Modifier does not belong to this menu item');
      }

      const selected = item.rows[0];
      await client.query('INSERT INTO order_lines(id,order_id,menu_item_id,item_name,unit_price,currency,quantity,modifiers,allergen_note,guest_note,station_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [`order_line_${randomUUID()}`, orderId, selected.id, selected.name, selected.price, selected.currency, line.quantity, JSON.stringify(modifierIds), line.allergenNote?.trim() || null, line.guestNote?.trim() || null, selected.station_code]);
    }
  }

  return {
    async createDraft(actor, input, key, requestId) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId);

      return transaction(key, 'ORDER_DRAFT', async (client) => {
        const session = await client.query<{ branch_id: string; status: string }>('SELECT branch_id,status FROM service_sessions WHERE id=$1 FOR UPDATE', [input.serviceSessionId]);
        assert(session.rowCount && session.rows[0].branch_id === input.branchId && session.rows[0].status === 'ACTIVE', 'CONFLICT', 'Service session is not active', 409);
        const orderId = `order_${randomUUID()}`;
        const round = await client.query<{ value: string }>('SELECT COALESCE(MAX(round_number),0)::text AS value FROM orders WHERE service_session_id=$1', [input.serviceSessionId]);
        await client.query('INSERT INTO orders(id,branch_id,service_session_id,round_number,course_policy,created_by) VALUES($1,$2,$3,$4,$5,$6)', [orderId, input.branchId, input.serviceSessionId, Number(round.rows[0].value) + 1, input.coursePolicy, actor.id]);

        await writeLines(client, orderId, input.branchId, input.lines);

        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [input.branchId, actor.id, 'ORDER_DRAFT', 'ORDER', orderId, requestId]);

        return readOrder(client, orderId);
      });
    },
    async updateDraft(actor, orderId, input, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transaction(key, 'ORDER_DRAFT_UPDATE', async (client) => {
        const found = await client.query<OrderRow>('SELECT id,branch_id,service_session_id,status,round_number,course_policy FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
        assert(found.rowCount, 'NOT_FOUND', 'Order not found', 404);
        const order = found.rows[0];
        assertBranchScope(actor, order.branch_id);
        assert(order.status === 'DRAFT', 'CONFLICT', 'Only draft orders can be changed', 409);
        await client.query('DELETE FROM order_lines WHERE order_id=$1', [orderId]);
        await writeLines(client, orderId, order.branch_id, input.lines);
        await client.query('UPDATE orders SET course_policy=$2 WHERE id=$1', [orderId, input.coursePolicy]);
        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [order.branch_id, actor.id, 'ORDER_DRAFT_UPDATED', 'ORDER', orderId, requestId]);

        return readOrder(client, orderId);
      });
    },
    async send(actor, orderId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transaction(key, 'ORDER_SEND', async (client) => {
        const found = await client.query<OrderRow>('SELECT id,branch_id,service_session_id,status,round_number,course_policy FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
        assert(found.rowCount, 'NOT_FOUND', 'Order not found', 404); assertBranchScope(actor, found.rows[0].branch_id); assert(found.rows[0].status === 'DRAFT', 'CONFLICT', 'Only draft orders can be sent', 409);
        const lines = await client.query<{ menu_item_id: string; item_name: string; quantity: number; modifiers: unknown; allergen_note: string | null; guest_note: string | null; station_code: 'KITCHEN' | 'BAR' }>('SELECT menu_item_id,item_name,quantity,modifiers,allergen_note,guest_note,station_code FROM order_lines WHERE order_id=$1', [orderId]);
        assert(lines.rowCount, 'CONFLICT', 'Order has no lines', 409);
        await client.query('UPDATE orders SET status=$2,sent_at=now() WHERE id=$1', [orderId, 'SENT']);

        const sessionTable = await client.query<{ table_label: string }>('SELECT t.label AS table_label FROM service_sessions ss JOIN restaurant_tables t ON t.id=ss.table_id WHERE ss.id=$1', [found.rows[0].service_session_id]);
        const tableLabel = sessionTable.rows[0]?.table_label ?? 'Bàn';

        for (const stationCode of ['KITCHEN', 'BAR'] as const) {
          const stationLines = lines.rows.filter((line) => line.station_code === stationCode);

          if (!stationLines.length) continue;
          await client.query('INSERT INTO ticket_snapshots(id,order_id,branch_id,station_code,snapshot) VALUES($1,$2,$3,$4,$5)', [`ticket_${randomUUID()}`, orderId, found.rows[0].branch_id, stationCode, JSON.stringify({ orderId, serviceSessionId: found.rows[0].service_session_id, tableLabel, roundNumber: found.rows[0].round_number, coursePolicy: found.rows[0].course_policy, stationCode, lines: stationLines })]);
        }

        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [found.rows[0].branch_id, actor.id, 'ORDER_SENT', 'ORDER', orderId, requestId]);

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
      const table = await pool.query<{ id: string; label: string; qr_token_version: number }>('SELECT t.id,t.label,t.qr_token_version FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE t.id=$1 AND a.branch_id=$2', [payload.tableId, payload.branchId]);
      assert(table.rowCount && table.rows[0].qr_token_version === payload.version, 'UNAUTHENTICATED', 'Table QR is invalid', 401);
      const session = await pool.query<{ id: string }>('SELECT id FROM service_sessions WHERE table_id=$1 AND branch_id=$2 AND status=$3', [payload.tableId, payload.branchId, 'ACTIVE']);
      assert(session.rowCount, 'CONFLICT', 'There is no active table session', 409);
      const items = await pool.query<{ id: string; name: string; description: string; price: string; currency: string; allergen_codes: string[]; station_code: 'KITCHEN' | 'BAR' }>('SELECT mi.id,mi.name,mi.description,mi.price,mi.currency,mi.allergen_codes,mi.station_code FROM menu_items mi JOIN branches b ON b.restaurant_id=mi.restaurant_id WHERE b.id=$1 AND mi.status=$2 ORDER BY mi.name', [payload.branchId, 'PUBLISHED']);

      return { branchId: payload.branchId, tableId: payload.tableId, tableLabel: table.rows[0].label, serviceSessionId: session.rows[0].id, items: items.rows.map((item) => ({ id: item.id, name: item.name, description: item.description, price: Number(item.price), currency: item.currency, allergenCodes: item.allergen_codes, stationCode: item.station_code })) };
    },
    async submitGuestRequest(token, lines, key) {
      assert(lines.length > 0, 'VALIDATION_ERROR', 'At least one request line is required');
      const guest = await this.guestMenu(token);

      return transaction(key, 'GUEST_ADD_ON', async (client) => {
        const id = `request_${randomUUID()}`;
        const created = await client.query<{ id: string; branch_id: string; service_session_id: string; status: 'SUBMITTED'; payload: { lines: import('./types.js').OrderLineInput[] }; created_at: Date }>('INSERT INTO foh_requests(id,branch_id,service_session_id,payload) VALUES($1,$2,$3,$4) RETURNING id,branch_id,service_session_id,status,payload,created_at', [id, guest.branchId, guest.serviceSessionId, JSON.stringify({ lines })]);
        const row = created.rows[0];

        return { id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, lines: row.payload.lines, createdAt: row.created_at.toISOString() };
      });
    },
    async listRequests(actor, branchId) {
      assertPermission(actor, 'queue:read'); assertBranchScope(actor, branchId);
      const rows = await pool.query<{ id: string; branch_id: string; service_session_id: string; status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COMPLETED'; payload: { lines: import('./types.js').OrderLineInput[] }; order_id: string | null; created_at: Date }>('SELECT id,branch_id,service_session_id,status,payload,order_id,created_at FROM foh_requests WHERE branch_id=$1 ORDER BY created_at DESC', [branchId]);

      return rows.rows.map((row) => ({ id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, lines: row.payload.lines, orderId: row.order_id ?? undefined, createdAt: row.created_at.toISOString() }));
    },
    async commandRequest(actor, requestId, command, key, auditRequestId) {
      assertPermission(actor, 'queue:write');

      return transaction(key, `FOH_REQUEST_${command.toUpperCase()}`, async (client) => {
        const found = await client.query<{ id: string; branch_id: string; service_session_id: string; status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COMPLETED'; payload: { lines: import('./types.js').OrderLineInput[] }; order_id: string | null; created_at: Date }>('SELECT id,branch_id,service_session_id,status,payload,order_id,created_at FROM foh_requests WHERE id=$1 FOR UPDATE', [requestId]);
        assert(found.rowCount, 'NOT_FOUND', 'FOH request not found', 404); const current = found.rows[0]; assertBranchScope(actor, current.branch_id);
        const status = command === 'acknowledge' ? 'ACKNOWLEDGED' : command === 'reject' ? 'REJECTED' : 'COMPLETED';
        assert(current.status === 'SUBMITTED' || current.status === 'ACKNOWLEDGED' && command === 'complete', 'CONFLICT', 'Request cannot transition', 409);
        let orderId = current.order_id;

        if (command === 'acknowledge') {
          const session = await client.query<{ status: string; branch_id: string }>('SELECT status,branch_id FROM service_sessions WHERE id=$1 FOR UPDATE', [current.service_session_id]);
          assert(session.rowCount && session.rows[0].status === 'ACTIVE' && session.rows[0].branch_id === current.branch_id, 'CONFLICT', 'Table session is no longer active', 409);
          orderId = `order_${randomUUID()}`;
          const round = await client.query<{ value: string }>('SELECT COALESCE(MAX(round_number),0)::text AS value FROM orders WHERE service_session_id=$1', [current.service_session_id]);
          await client.query('INSERT INTO orders(id,branch_id,service_session_id,round_number,course_policy,created_by) VALUES($1,$2,$3,$4,$5,$6)', [orderId, current.branch_id, current.service_session_id, Number(round.rows[0].value) + 1, 'AS_READY', actor.id]);
          await writeLines(client, orderId, current.branch_id, current.payload.lines);
        }

        const updated = await client.query<{ id: string; branch_id: string; service_session_id: string; status: typeof status; payload: { lines: import('./types.js').OrderLineInput[] }; order_id: string | null; created_at: Date }>('UPDATE foh_requests SET status=$2,order_id=COALESCE($3,order_id),acknowledged_by=CASE WHEN $2=$4 THEN $5 ELSE acknowledged_by END,acknowledged_at=CASE WHEN $2=$4 THEN now() ELSE acknowledged_at END WHERE id=$1 RETURNING id,branch_id,service_session_id,status,payload,order_id,created_at', [requestId, status, orderId, 'ACKNOWLEDGED', actor.id]);
        await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [current.branch_id, actor.id, `FOH_REQUEST_${command.toUpperCase()}`, 'FOH_REQUEST', requestId, auditRequestId]);
        const row = updated.rows[0];

        return { id: row.id, branchId: row.branch_id, serviceSessionId: row.service_session_id, status: row.status, lines: row.payload.lines, orderId: row.order_id ?? undefined, createdAt: row.created_at.toISOString() };
      });
    }
  };
}
