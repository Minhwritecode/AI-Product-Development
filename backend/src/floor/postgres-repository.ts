import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { CleaningTask, FloorRepository, FloorTable, ServiceSession } from './types.js';

type Row = {
  id: string;
  branch_id: string;
  table_id: string;
  area_id: string;
  label: string;
  capacity: number;
  accessibility_tags: string[];
  party_size: number;
  status: string;
  source_type: ServiceSession['sourceType'];
  source_id: string | null;
  opened_by: string;
  opened_at: Date;
  closed_at: Date | null;
  session_id: string | null;
  priority: CleaningTask['priority'];
  claimed_by: string | null;
  completed_by: string | null;
  created_at: Date;
  completed_at: Date | null;
};

const date = (value: Date | string) => value instanceof Date ? value.toISOString() : value;

// SAFETY: service_sessions.status is constrained by the database migration; source_type is constrained to the session enum.
const session = (row: Row): ServiceSession => ({ id: String(row.id), branchId: String(row.branch_id), tableId: String(row.table_id), partySize: Number(row.party_size), status: row.status as ServiceSession['status'], sourceType: row.source_type, sourceId: row.source_id ? String(row.source_id) : undefined, openedBy: String(row.opened_by), openedAt: date(row.opened_at), closedAt: row.closed_at ? date(row.closed_at) : undefined });

// SAFETY: cleaning_tasks.status is constrained by the database migration; priority is constrained to the task enum.
const task = (row: Row): CleaningTask => ({ id: String(row.id), branchId: String(row.branch_id), tableId: String(row.table_id), sessionId: row.session_id ? String(row.session_id) : undefined, status: row.status as CleaningTask['status'], priority: row.priority, claimedBy: row.claimed_by ? String(row.claimed_by) : undefined, completedBy: row.completed_by ? String(row.completed_by) : undefined, createdAt: date(row.created_at), completedAt: row.completed_at ? date(row.completed_at) : undefined });

export function createPostgresFloorRepository(pool: pg.Pool): FloorRepository {
  async function transact<T>(key: string, command: string, run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`floor:${key}`]);
      const prior = await client.query<{ response: T }>('SELECT response FROM guest_idempotency_records WHERE idempotency_key=$1 AND command=$2', [key, command]);

      if (prior.rowCount) { await client.query('COMMIT');

 return prior.rows[0].response; }

      const result = await run(client);
      await client.query('INSERT INTO guest_idempotency_records(idempotency_key,command,response) VALUES($1,$2,$3)', [key, command, JSON.stringify(result)]);
      await client.query('COMMIT');

 return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async function audit(client: pg.PoolClient, actorId: string, branchId: string, action: string, kind: string, id: string, requestId: string) {
    await client.query('INSERT INTO audit_logs(branch_id,actor_id,action,entity_type,entity_id,request_id) VALUES($1,$2,$3,$4,$5,$6)', [branchId, actorId, action, kind, id, requestId]);
  }

  async function releaseExpiredHolds(executor: pg.Pool | pg.PoolClient) {
    await executor.query("WITH expired AS (DELETE FROM table_holds WHERE expires_at <= now() RETURNING table_id) UPDATE restaurant_tables SET status='READY' WHERE id IN (SELECT table_id FROM expired) AND status='HELD'");
  }

  async function cleaningPriority(client: pg.PoolClient, branchId: string): Promise<CleaningTask['priority']> {
    const waiting = await client.query<{ present: boolean }>("SELECT EXISTS(SELECT 1 FROM queue_entries WHERE branch_id=$1 AND status IN ('WAITING','CALLED')) AS present", [branchId]);

    return waiting.rows[0]?.present ? 'HIGH' : 'NORMAL';
  }

  return {
    async board(actor, branchId) {
      assertPermission(actor, 'queue:read'); assertBranchScope(actor, branchId);
      await releaseExpiredHolds(pool);

      const [tableRows, sessions, tasks] = await Promise.all([
        pool.query<Row>('SELECT t.* FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE a.branch_id=$1 ORDER BY a.sort_order,t.label', [branchId]),
        pool.query<Row>('SELECT * FROM service_sessions WHERE branch_id=$1 AND status=$2 ORDER BY opened_at', [branchId, 'ACTIVE']),
        pool.query<Row>('SELECT * FROM cleaning_tasks WHERE branch_id=$1 AND status<>$2 ORDER BY created_at', [branchId, 'COMPLETE'])
      ]);

      // SAFETY: restaurant_tables.status is constrained by the database migration and accessibility_tags is stored as a JSON array.
      return { tables: tableRows.rows.map((row): FloorTable => ({ id: row.id, areaId: row.area_id, label: row.label, capacity: Number(row.capacity), accessibilityTags: row.accessibility_tags, status: row.status as FloorTable['status'] })), sessions: sessions.rows.map(session), cleaningTasks: tasks.rows.map(task), asOf: new Date().toISOString() };
    },
    async hold(actor, input, key, requestId) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId);
      assert(input.minutes >= 1 && input.minutes <= 30, 'VALIDATION_ERROR', 'Hold must be 1 to 30 minutes');

      return transact(key, 'TABLE_HOLD', async (client) => {
        await releaseExpiredHolds(client);
        const found = await client.query<Row>('SELECT t.* FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE t.id=$1 AND a.branch_id=$2 FOR UPDATE OF t', [input.tableId, input.branchId]);
        assert(found.rowCount && found.rows[0].status === 'READY', 'TABLE_NOT_READY', 'Table is not ready', 409);
        assert(input.partySize <= Number(found.rows[0].capacity), 'CAPACITY_EXCEEDED', 'Party does not fit this table', 409);
        const id = `hold_${randomUUID()}`; const expiresAt = new Date(Date.now() + input.minutes * 60_000).toISOString();
        await client.query('INSERT INTO table_holds(id,branch_id,table_id,party_size,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6)', [id,input.branchId,input.tableId,input.partySize,expiresAt,actor.id]);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1', [input.tableId,'HELD']);
        await audit(client,actor.id,input.branchId,'HOLD','TABLE',input.tableId,requestId);

 return { id, tableId: input.tableId, expiresAt };
      });
    },
    async seat(actor, input, key, requestId) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId);
      assert(input.sourceType === 'WALK_IN' || Boolean(input.sourceId), 'VALIDATION_ERROR', 'Source ID is required');

      return transact(key, 'FLOOR_SEAT', async (client) => {
        const found = await client.query<Row>('SELECT t.* FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE t.id=$1 AND a.branch_id=$2 FOR UPDATE OF t', [input.tableId, input.branchId]);
        assert(found.rowCount, 'NOT_FOUND', 'Table not found', 404);
        const table = found.rows[0]; assert(table.status === 'READY' || table.status === 'HELD', 'TABLE_NOT_READY', 'Table is not ready', 409);
        assert(input.partySize <= Number(table.capacity), 'CAPACITY_EXCEEDED', 'Party does not fit this table', 409);
        const id = `service_${randomUUID()}`;
        const created = await client.query<Row>('INSERT INTO service_sessions(id,branch_id,table_id,party_size,source_type,source_id,opened_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [id,input.branchId,input.tableId,input.partySize,input.sourceType,input.sourceId ?? null,actor.id]);
        await client.query('DELETE FROM table_holds WHERE table_id=$1', [input.tableId]);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1', [input.tableId,'IN_USE']);
        await audit(client,actor.id,input.branchId,'SEAT','SERVICE_SESSION',id,requestId);

        return session(created.rows[0]);
      });
    },
    async vacate(actor, sessionId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'FLOOR_VACATE', async (client) => {
        const found = await client.query<Row>('SELECT * FROM service_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
        assert(found.rowCount, 'NOT_FOUND', 'Session not found', 404); const current = found.rows[0]; const branchId = String(current.branch_id);
        assertBranchScope(actor,branchId); assert(current.status === 'ACTIVE','CONFLICT','Session already closed',409);
        const tableId = String(current.table_id);
        await client.query('UPDATE service_sessions SET status=$2,closed_at=now() WHERE id=$1',[sessionId,'CLOSED']);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1',[tableId,'WAITING_CLEANING']);
        const id = `clean_${randomUUID()}`;
        const created = await client.query<Row>('INSERT INTO cleaning_tasks(id,branch_id,table_id,session_id,priority) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,branchId,tableId,sessionId,await cleaningPriority(client, branchId)]);
        await audit(client,actor.id,branchId,'VACATE','SERVICE_SESSION',sessionId,requestId);

        return task(created.rows[0]);
      });
    },
    async transfer(actor, sessionId, tableId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key, 'FLOOR_TRANSFER', async (client) => {
        const current = await client.query<Row>('SELECT * FROM service_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
        assert(current.rowCount, 'NOT_FOUND', 'Session not found', 404); const active = current.rows[0]; assertBranchScope(actor, active.branch_id);
        assert(active.status === 'ACTIVE', 'CONFLICT', 'Session is closed', 409);
        const target = await client.query<Row>('SELECT t.* FROM restaurant_tables t JOIN areas a ON a.id=t.area_id WHERE t.id=$1 AND a.branch_id=$2 FOR UPDATE OF t', [tableId,active.branch_id]);
        assert(target.rowCount && target.rows[0].status === 'READY', 'TABLE_NOT_READY', 'Target table is not ready', 409);
        assert(active.party_size <= target.rows[0].capacity, 'CAPACITY_EXCEEDED', 'Party does not fit this table', 409);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1', [active.table_id,'WAITING_CLEANING']);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1', [tableId,'IN_USE']);
        const updated = await client.query<Row>('UPDATE service_sessions SET table_id=$2 WHERE id=$1 RETURNING *', [sessionId,tableId]);
        const cleaningId = `clean_${randomUUID()}`;
        await client.query('INSERT INTO cleaning_tasks(id,branch_id,table_id,session_id,priority) VALUES($1,$2,$3,$4,$5)', [cleaningId,active.branch_id,active.table_id,sessionId,await cleaningPriority(client, active.branch_id)]);
        await audit(client,actor.id,active.branch_id,'TRANSFER','SERVICE_SESSION',sessionId,requestId);

 return session(updated.rows[0]);
      });
    },
    async claimCleaning(actor, taskId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key,'CLEAN_CLAIM',async(client)=>{
        const found=await client.query<Row>('SELECT * FROM cleaning_tasks WHERE id=$1 FOR UPDATE',[taskId]);
        assert(found.rowCount,'NOT_FOUND','Cleaning task not found',404); const row=found.rows[0]; const branchId=String(row.branch_id);
        assertBranchScope(actor,branchId); assert(row.status==='OPEN','CONFLICT','Cleaning task is not open',409);
        const updated=await client.query<Row>('UPDATE cleaning_tasks SET status=$2,claimed_by=$3 WHERE id=$1 RETURNING *',[taskId,'CLAIMED',actor.id]);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1',[row.table_id,'CLEANING']);
        await audit(client,actor.id,branchId,'CLAIM','CLEANING_TASK',taskId,requestId);

 return task(updated.rows[0]);
      });
    },
    async completeCleaning(actor, taskId, key, requestId) {
      assertPermission(actor, 'queue:write');

      return transact(key,'CLEAN_COMPLETE',async(client)=>{
        const found=await client.query<Row>('SELECT * FROM cleaning_tasks WHERE id=$1 FOR UPDATE',[taskId]);
        assert(found.rowCount,'NOT_FOUND','Cleaning task not found',404); const row=found.rows[0]; const branchId=String(row.branch_id);
        assertBranchScope(actor,branchId); assert(row.status==='CLAIMED','CONFLICT','Cleaning must be claimed first',409);
        const updated=await client.query<Row>('UPDATE cleaning_tasks SET status=$2,completed_by=$3,completed_at=now() WHERE id=$1 RETURNING *',[taskId,'COMPLETE',actor.id]);
        await client.query('UPDATE restaurant_tables SET status=$2 WHERE id=$1',[row.table_id,'READY']);
        await audit(client,actor.id,branchId,'COMPLETE','CLEANING_TASK',taskId,requestId);

 return task(updated.rows[0]);
      });
    }
  };
}
