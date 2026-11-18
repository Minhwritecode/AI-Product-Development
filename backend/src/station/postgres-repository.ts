import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { StationCode, StationRepository, StationTicket, TicketStatus } from './types.js';

type TicketRow = {
  id: string;
  order_id: string;
  branch_id: string;
  station_code: StationCode;
  status: TicketStatus;
  snapshot: {
    tableLabel?: string;
    roundNumber?: number;
    coursePolicy?: 'AS_READY' | 'SERVE_TOGETHER';
    lines?: import('./types.js').TicketLine[];
  };
  created_at: Date;
  accepted_by: string | null;
  accepted_at: Date | null;
  prepared_by: string | null;
  prepared_at: Date | null;
  picked_up_by: string | null;
  picked_up_at: Date | null;
  served_by: string | null;
  served_at: Date | null;
  delayed_at: Date | null;
  delay_reason: string | null;
  rejected_at: Date | null;
  reject_reason: string | null;
};

function mapTicket(row: TicketRow): StationTicket {
  const payload = row.snapshot;

  return {
    id: row.id,
    orderId: row.order_id,
    branchId: row.branch_id,
    stationCode: row.station_code,
    status: row.status,
    tableLabel: payload.tableLabel ?? 'Bàn',
    roundNumber: payload.roundNumber ?? 1,
    coursePolicy: payload.coursePolicy ?? 'AS_READY',
    lines: payload.lines ?? [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    acceptedBy: row.accepted_by ?? undefined,
    acceptedAt: row.accepted_at ? (row.accepted_at instanceof Date ? row.accepted_at.toISOString() : String(row.accepted_at)) : undefined,
    preparedBy: row.prepared_by ?? undefined,
    preparedAt: row.prepared_at ? (row.prepared_at instanceof Date ? row.prepared_at.toISOString() : String(row.prepared_at)) : undefined,
    pickedUpBy: row.picked_up_by ?? undefined,
    pickedUpAt: row.picked_up_at ? (row.picked_up_at instanceof Date ? row.picked_up_at.toISOString() : String(row.picked_up_at)) : undefined,
    servedBy: row.served_by ?? undefined,
    servedAt: row.served_at ? (row.served_at instanceof Date ? row.served_at.toISOString() : String(row.served_at)) : undefined,
    delayedAt: row.delayed_at ? (row.delayed_at instanceof Date ? row.delayed_at.toISOString() : String(row.delayed_at)) : undefined,
    delayReason: row.delay_reason ?? undefined,
    rejectedAt: row.rejected_at ? (row.rejected_at instanceof Date ? row.rejected_at.toISOString() : String(row.rejected_at)) : undefined,
    rejectReason: row.reject_reason ?? undefined
  };
}

export function createPostgresStationRepository(pool: pg.Pool): StationRepository {
  async function transact<T>(key: string, command: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const prior = await client.query<{ response: T }>(
        'SELECT response FROM guest_idempotency_records WHERE idempotency_key=$1 AND command=$2',
        [key, command]
      );

      if (prior.rowCount) {
        await client.query('COMMIT');

        return prior.rows[0].response;
      }

      const result = await work(client);
      await client.query(
        'INSERT INTO guest_idempotency_records(idempotency_key, command, response) VALUES($1, $2, $3)',
        [key, command, JSON.stringify(result)]
      );
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function audit(client: pg.PoolClient, branchId: string, actorId: string, action: string, ticketId: string, requestId: string) {
    await client.query(
      'INSERT INTO audit_logs(branch_id, actor_id, action, entity_type, entity_id, request_id) VALUES($1, $2, $3, $4, $5, $6)',
      [branchId, actorId, action, 'STATION_TICKET', ticketId, requestId]
    );
  }

  return {
    async listTickets(actor, branchId, stationCode, status) {
      assertPermission(actor, 'queue:read');
      assertBranchScope(actor, branchId);

      const conditions = ['branch_id=$1'];
      const params: unknown[] = [branchId];

      if (stationCode) {
        params.push(stationCode);
        conditions.push(`station_code=$${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`status=$${params.length}`);
      }

      const rows = await pool.query<TicketRow>(
        `SELECT * FROM ticket_snapshots WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC`,
        params
      );

      return rows.rows.map(mapTicket);
    },

    async servingQueue(actor, branchId) {
      assertPermission(actor, 'queue:read');
      assertBranchScope(actor, branchId);

      const rows = await pool.query<TicketRow>(
        "SELECT * FROM ticket_snapshots WHERE branch_id=$1 AND status IN ('READY', 'PICKED_UP') ORDER BY created_at ASC",
        [branchId]
      );

      return rows.rows.map(mapTicket);
    },

    async accept(actor, ticketId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'STATION_TICKET_ACCEPT', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(ticket.status === 'NEW', 'CONFLICT', `Cannot accept ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, accepted_by=$3, accepted_at=now() WHERE id=$1 RETURNING *',
          [ticketId, 'ACCEPTED', actor.id]
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_ACCEPTED', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    },

    async start(actor, ticketId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'STATION_TICKET_START', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(ticket.status === 'ACCEPTED' || ticket.status === 'NEW', 'CONFLICT', `Cannot start ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, prepared_by=$3, prepared_at=now() WHERE id=$1 RETURNING *',
          [ticketId, 'PREPARING', actor.id]
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_PREPARING', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    },

    async ready(actor, ticketId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'STATION_TICKET_READY', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(ticket.status === 'PREPARING' || ticket.status === 'ACCEPTED', 'CONFLICT', `Cannot complete ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, prepared_at=COALESCE(prepared_at, now()) WHERE id=$1 RETURNING *',
          [ticketId, 'READY']
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_READY', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    },

    async delay(actor, ticketId, reason, key, requestId) {
      assertPermission(actor, 'queue:write');
      assert(reason.trim().length > 0, 'VALIDATION_ERROR', 'Delay reason is required');

      return transact(key, 'STATION_TICKET_DELAY', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(['NEW', 'ACCEPTED', 'PREPARING'].includes(ticket.status), 'CONFLICT', `Cannot delay ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, delayed_at=now(), delay_reason=$3 WHERE id=$1 RETURNING *',
          [ticketId, 'DELAYED', reason.trim()]
        );

        // Sinh OperationalTask cho Server/Manager
        const taskId = `task_${randomUUID().slice(0, 8)}`;
        const payload = ticket.snapshot;
        const tableLabel = payload.tableLabel ?? 'Bàn';
        await client.query(
          "INSERT INTO operational_tasks(id, branch_id, title, source_type, source_id, priority, station_code, status) VALUES($1, $2, $3, 'EXCEPTION', $4, 'HIGH', $5, 'OPEN')",
          [taskId, ticket.branch_id, `[Chậm trạm ${ticket.station_code}] Bàn ${tableLabel}: ${reason.trim()}`, ticketId, ticket.station_code]
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_DELAYED', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    },

    async reject(actor, ticketId, reason, key, requestId) {
      assertPermission(actor, 'queue:write');
      assert(reason.trim().length > 0, 'VALIDATION_ERROR', 'Reject reason is required');

      return transact(key, 'STATION_TICKET_REJECT', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(['NEW', 'ACCEPTED', 'DELAYED'].includes(ticket.status), 'CONFLICT', `Cannot reject ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, rejected_at=now(), reject_reason=$3 WHERE id=$1 RETURNING *',
          [ticketId, 'REJECTED', reason.trim()]
        );

        // Sinh OperationalTask URGENT cho Manager/Server
        const taskId = `task_${randomUUID().slice(0, 8)}`;
        const payload = ticket.snapshot;
        const tableLabel = payload.tableLabel ?? 'Bàn';
        await client.query(
          "INSERT INTO operational_tasks(id, branch_id, title, source_type, source_id, priority, station_code, status) VALUES($1, $2, $3, 'EXCEPTION', $4, 'URGENT', $5, 'OPEN')",
          [taskId, ticket.branch_id, `[Từ chối trạm ${ticket.station_code}] Bàn ${tableLabel}: ${reason.trim()}`, ticketId, ticket.station_code]
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_REJECTED', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    },

    async pickup(actor, ticketId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'STATION_TICKET_PICKUP', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(ticket.status === 'READY', 'CONFLICT', `Cannot pickup ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, picked_up_by=$3, picked_up_at=now() WHERE id=$1 RETURNING *',
          [ticketId, 'PICKED_UP', actor.id]
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_PICKED_UP', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    },

    async serve(actor, ticketId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'STATION_TICKET_SERVE', async (client) => {
        const found = await client.query<TicketRow>('SELECT * FROM ticket_snapshots WHERE id=$1 FOR UPDATE', [ticketId]);
        assert(found.rowCount, 'NOT_FOUND', 'Ticket not found', 404);
        const ticket = found.rows[0];
        assertBranchScope(actor, ticket.branch_id);
        assert(ticket.status === 'PICKED_UP' || ticket.status === 'READY', 'CONFLICT', `Cannot serve ticket in status ${ticket.status}`, 409);

        const updated = await client.query<TicketRow>(
          'UPDATE ticket_snapshots SET status=$2, served_by=$3, served_at=now() WHERE id=$1 RETURNING *',
          [ticketId, 'SERVED', actor.id]
        );

        await audit(client, ticket.branch_id, actor.id, 'TICKET_SERVED', ticketId, requestId);

        return mapTicket(updated.rows[0]);
      });
    }
  };
}
