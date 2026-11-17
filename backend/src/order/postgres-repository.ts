import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Order, OrderRepository } from './types.js';

type OrderRow = { id: string; branch_id: string; service_session_id: string; status: Order['status']; round_number: number; course_policy: Order['coursePolicy'] };

type ItemRow = { id: string; name: string; price: string; currency: string; station_code: 'KITCHEN' | 'BAR'; status: string };

export function createPostgresOrderRepository(pool: pg.Pool): OrderRepository {
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
  };
}
