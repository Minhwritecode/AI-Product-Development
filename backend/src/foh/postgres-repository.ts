import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Actor } from '../platform/types.js';
import type { CreateQueueInput, FohRepository, FrontDoorStatus, OperatingState, QueueEntry, Reservation } from './types.js';

type QueueRow = { id: string; branch_id: string; queue_code: string; status: QueueEntry['status']; party_size: number; time_budget_minutes: number; language: QueueEntry['language']; nickname?: string; notification_opt_in: boolean; created_at: string; called_at?: string; completed_at?: string };

type ReservationRow = { id: string; branch_id: string; status: Reservation['status']; party_size: number; reserved_for: string; hold_until?: string; language: Reservation['language']; nickname?: string; created_at: string; updated_at: string };

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function createPostgresFohRepository(pool: pg.Pool): FohRepository {
  async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  }

  async function replay<T extends QueueEntry | Reservation>(key: string, command: string): Promise<T | undefined> {
    const result = await pool.query<{ response: T }>('SELECT response FROM guest_idempotency_records WHERE idempotency_key = $1 AND command = $2', [key, command]);

    return result.rowCount ? result.rows[0].response : undefined;
  }

  async function remember(client: pg.PoolClient, key: string, command: string, response: QueueEntry | Reservation): Promise<void> {
    await client.query('INSERT INTO guest_idempotency_records (idempotency_key, command, response) VALUES ($1, $2, $3)', [key, command, JSON.stringify(response)]);
  }

  function mapQueue(row: QueueRow, accessToken: string): QueueEntry {
    return { id: row.id, branchId: row.branch_id, queueCode: row.queue_code, accessToken, status: row.status, partySize: row.party_size, timeBudgetMinutes: row.time_budget_minutes, language: row.language, nickname: row.nickname ?? undefined, notificationOptIn: row.notification_opt_in, createdAt: row.created_at, calledAt: row.called_at ?? undefined, completedAt: row.completed_at ?? undefined };
  }

  function mapReservation(row: ReservationRow): Reservation {
    return { id: row.id, branchId: row.branch_id, status: row.status, partySize: row.party_size, reservedFor: row.reserved_for, holdUntil: row.hold_until ?? undefined, language: row.language, nickname: row.nickname ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async function status(branchId: string, executor: Pick<pg.Pool, 'query'> = pool): Promise<FrontDoorStatus> {
    const [branch, operating, policy, queue, tables] = await Promise.all([
      executor.query('SELECT id FROM branches WHERE id = $1 AND status = \'ACTIVE\'', [branchId]),
      executor.query<{ state: OperatingState }>('SELECT state FROM branch_operating_states WHERE branch_id = $1', [branchId]),
      executor.query<{ capacity: number; base_wait_minutes: number; wait_step_minutes: number }>('SELECT capacity, base_wait_minutes, wait_step_minutes FROM queue_policies WHERE branch_id = $1', [branchId]),
      executor.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM queue_entries WHERE branch_id = $1 AND status IN (\'WAITING\', \'CALLED\')', [branchId]),
      executor.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM restaurant_tables rt JOIN areas a ON a.id = rt.area_id WHERE a.branch_id = $1 AND rt.status = \'READY\'', [branchId])
    ]);

    assert(branch.rowCount, 'NOT_FOUND', 'Branch not found', 404);
    const state = operating.rows[0]?.state ?? 'OPEN';
    const queueSize = Number(queue.rows[0]?.count ?? 0);
    const availableTables = state === 'OPEN' ? Number(tables.rows[0]?.count ?? 0) : 0;
    const baseWait = Number(policy.rows[0]?.base_wait_minutes ?? 15);
    const waitStep = Number(policy.rows[0]?.wait_step_minutes ?? 10);
    const min = availableTables > 0 ? 0 : baseWait + queueSize * waitStep;

    return { branchId, operatingState: state, availableTables, queueSize, queueCapacity: Number(policy.rows[0]?.capacity ?? 40), estimatedWait: { min, max: availableTables > 0 ? baseWait : min + waitStep * 2, unit: 'MINUTES' }, asOf: new Date().toISOString(), confidence: queueSize < 20 ? 'MEDIUM' : 'LOW', limitations: ['Estimated wait is a range, not a promise.', 'The system does not predict the exact time a guest leaves a table.'] };
  }

  const repository: FohRepository = {
    async getFrontDoorStatus(branchId) { return status(branchId); },

    async joinQueue(input: CreateQueueInput, idempotencyKey) {
      const previous = await replay<QueueEntry>(idempotencyKey, 'QUEUE_JOIN');

      if (previous) return previous;

      return transaction(async (client) => {
        await client.query('SELECT id FROM branches WHERE id = $1 AND status = \'ACTIVE\' FOR UPDATE', [input.branchId]);

        const current = await status(input.branchId, client);

        assert(current.operatingState === 'OPEN', 'QUEUE_NOT_OPEN', 'Queue is not accepting guests', 409);
        assert(input.partySize >= 1 && input.partySize <= 20, 'VALIDATION_ERROR', 'Party size must be between 1 and 20');
        assert(input.timeBudgetMinutes >= 15 && input.timeBudgetMinutes <= 180, 'VALIDATION_ERROR', 'Time budget must be between 15 and 180 minutes');
        assert(current.queueSize < current.queueCapacity, 'QUEUE_FULL', 'Queue is full', 409);
        const accessToken = randomUUID();
        const id = `queue_${randomUUID().slice(0, 8)}`;
        const code = `L${Math.floor(Math.random() * 900 + 100)}`;
        const result = await client.query<QueueRow>('INSERT INTO queue_entries (id, branch_id, queue_code, access_token_hash, party_size, time_budget_minutes, language, nickname, notification_opt_in) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at', [id, input.branchId, code, hash(accessToken), input.partySize, input.timeBudgetMinutes, input.language, input.nickname?.trim() || null, input.notificationOptIn ?? false]);
        const response = mapQueue(result.rows[0], accessToken);

        await remember(client, idempotencyKey, 'QUEUE_JOIN', response);

        return response;
      });
    },

    async getQueueEntry(queueId, accessToken) {
      const result = await pool.query<QueueRow>('SELECT id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at FROM queue_entries WHERE id = $1 AND access_token_hash = $2', [queueId, hash(accessToken)]);

      assert(result.rowCount, 'NOT_FOUND', 'Queue entry not found', 404);

      return mapQueue(result.rows[0], accessToken);
    },

    async leaveQueue(queueId, accessToken, idempotencyKey) {
      const previous = await replay<QueueEntry>(idempotencyKey, 'QUEUE_LEAVE');

      if (previous) return previous;

      return transaction(async (client) => {
        const result = await client.query<QueueRow>('SELECT id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at FROM queue_entries WHERE id = $1 AND access_token_hash = $2 FOR UPDATE', [queueId, hash(accessToken)]);

        assert(result.rowCount, 'NOT_FOUND', 'Queue entry not found', 404);
        assert(['WAITING', 'CALLED'].includes(result.rows[0].status), 'CONFLICT', 'Queue entry cannot be left in this state', 409);
        const updated = await client.query<QueueRow>('UPDATE queue_entries SET status = \'LEFT\', completed_at = now() WHERE id = $1 RETURNING id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at', [queueId]);
        const response = mapQueue(updated.rows[0], accessToken);

        await remember(client, idempotencyKey, 'QUEUE_LEAVE', response);

        return response;
      });
    },

    async listQueue(actor: Actor, branchId) {
      assertPermission(actor, 'queue:read');
      assertBranchScope(actor, branchId);
      const result = await pool.query<QueueRow>('SELECT id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at FROM queue_entries WHERE branch_id = $1 ORDER BY created_at ASC', [branchId]);

      return result.rows.map((row) => mapQueue(row, ''));
    },

    async commandQueue(actor, queueId, command, requestId, reason) {
      assertPermission(actor, 'queue:write');

      return transaction(async (client) => {
        const result = await client.query<QueueRow>('SELECT id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at FROM queue_entries WHERE id = $1 FOR UPDATE', [queueId]);

        assert(result.rowCount, 'NOT_FOUND', 'Queue entry not found', 404);
        assertBranchScope(actor, result.rows[0].branch_id);
        const allowed: Record<typeof command, QueueEntry['status']> = { call: 'CALLED', seat: 'SEATED', cancel: 'CANCELLED', expire: 'EXPIRED' };
        assert((command === 'call' && result.rows[0].status === 'WAITING') || (command === 'seat' && result.rows[0].status === 'CALLED') || (command === 'cancel' && ['WAITING', 'CALLED'].includes(result.rows[0].status)) || (command === 'expire' && ['WAITING', 'CALLED'].includes(result.rows[0].status)), 'CONFLICT', 'Queue entry cannot transition from this state', 409);
        const updated = await client.query<QueueRow>(`UPDATE queue_entries SET status = $2, called_at = CASE WHEN $2 = 'CALLED' THEN now() ELSE called_at END, completed_at = CASE WHEN $2 IN ('SEATED', 'CANCELLED', 'EXPIRED') THEN now() ELSE completed_at END WHERE id = $1 RETURNING id, branch_id, queue_code, status, party_size, time_budget_minutes, language, nickname, notification_opt_in, created_at, called_at, completed_at`, [queueId, allowed[command]]);

        await client.query('INSERT INTO audit_logs (branch_id, actor_id, action, entity_type, entity_id, request_id, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)', [result.rows[0].branch_id, actor.id, `QUEUE_${command.toUpperCase()}`, 'QUEUE_ENTRY', queueId, requestId, reason ?? null]);

        return mapQueue(updated.rows[0], '');
      });
    },

    async createReservation(actor, input, idempotencyKey, requestId) {
      assertPermission(actor, 'reservation:write');
      assertBranchScope(actor, input.branchId);
      assert(input.partySize >= 1 && input.partySize <= 20, 'VALIDATION_ERROR', 'Party size must be between 1 and 20');
      assert(Number.isFinite(new Date(input.reservedFor).getTime()), 'VALIDATION_ERROR', 'Reservation time is invalid');
      const previous = await replay<Reservation>(idempotencyKey, 'RESERVATION_CREATE');

      if (previous) return previous;

      return transaction(async (client) => {
        const id = `reservation_${randomUUID().slice(0, 8)}`;
        const result = await client.query<ReservationRow>('INSERT INTO reservations (id, branch_id, party_size, reserved_for, language, nickname) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, branch_id, status, party_size, reserved_for, hold_until, language, nickname, created_at, updated_at', [id, input.branchId, input.partySize, input.reservedFor, input.language, input.nickname?.trim() || null]);

        await client.query('INSERT INTO audit_logs (branch_id, actor_id, action, entity_type, entity_id, request_id) VALUES ($1, $2, $3, $4, $5, $6)', [input.branchId, actor.id, 'RESERVATION_CREATED', 'RESERVATION', id, requestId]);
        const response = mapReservation(result.rows[0]);

        await remember(client, idempotencyKey, 'RESERVATION_CREATE', response);

        return response;
      });
    },

    async commandReservation(actor, reservationId, command, idempotencyKey, requestId) {
      assertPermission(actor, 'reservation:write');
      const previous = await replay<Reservation>(idempotencyKey, 'RESERVATION_COMMAND');

      if (previous) return previous;

      return transaction(async (client) => {
        const current = await client.query<ReservationRow>('SELECT id, branch_id, status, party_size, reserved_for, hold_until, language, nickname, created_at, updated_at FROM reservations WHERE id = $1 FOR UPDATE', [reservationId]);

        assert(current.rowCount, 'NOT_FOUND', 'Reservation not found', 404);
        assertBranchScope(actor, current.rows[0].branch_id);
        const next: Record<typeof command, Reservation['status']> = { confirm: 'CONFIRMED', arrive: 'ARRIVED', cancel: 'CANCELLED', 'no-show': 'NO_SHOW' };
        const allowed: Record<Reservation['status'], Reservation['status'][]> = { HELD: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'], ARRIVED: [], CANCELLED: [], NO_SHOW: [], EXPIRED: [] };

        assert(allowed[current.rows[0].status].includes(next[command]), 'CONFLICT', 'Reservation cannot transition from this state', 409);
        const updated = await client.query<ReservationRow>('UPDATE reservations SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, branch_id, status, party_size, reserved_for, hold_until, language, nickname, created_at, updated_at', [reservationId, next[command]]);

        await client.query('INSERT INTO audit_logs (branch_id, actor_id, action, entity_type, entity_id, request_id) VALUES ($1, $2, $3, $4, $5, $6)', [current.rows[0].branch_id, actor.id, `RESERVATION_${command.toUpperCase()}`, 'RESERVATION', reservationId, requestId]);
        const response = mapReservation(updated.rows[0]);

        await remember(client, idempotencyKey, 'RESERVATION_COMMAND', response);

        return response;
      });
    },

    async setOperatingState(actor, branchId, state, reason, requestId) {
      assertPermission(actor, 'queue:write');
      assertBranchScope(actor, branchId);
      assert(reason.trim().length >= 3, 'VALIDATION_ERROR', 'Operating state reason is required');

      await transaction(async (client) => {
        await client.query('INSERT INTO branch_operating_states (branch_id, state, reason, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (branch_id) DO UPDATE SET state = EXCLUDED.state, reason = EXCLUDED.reason, updated_by = EXCLUDED.updated_by, updated_at = now()', [branchId, state, reason.trim(), actor.id]);
        await client.query('INSERT INTO audit_logs (branch_id, actor_id, action, entity_type, entity_id, request_id, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)', [branchId, actor.id, 'OPERATING_STATE_UPDATED', 'BRANCH', branchId, requestId, reason.trim()]);
      });

      return status(branchId);
    }
  };

  return repository;
}
