import { randomUUID } from 'node:crypto';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { CleaningTask, FloorRepository, FloorTable, ServiceSession } from './types.js';

export function createMemoryFloorRepository(): FloorRepository {
  const tables = new Map<string, FloorTable>([
    ['table_01', { id: 'table_01', areaId: 'area_main', label: 'T01', capacity: 2, accessibilityTags: [], status: 'READY' }],
    ['table_02', { id: 'table_02', areaId: 'area_main', label: 'T02', capacity: 4, accessibilityTags: ['WHEELCHAIR'], status: 'READY' }],
    ['table_03', { id: 'table_03', areaId: 'area_rooftop', label: 'R01', capacity: 6, accessibilityTags: [], status: 'READY' }]
  ]);

  const sessions = new Map<string, ServiceSession>();
  const tasks = new Map<string, CleaningTask>();
  const replay = new Map<string, ServiceSession | CleaningTask>();
  const holds = new Map<string, { id: string; tableId: string; expiresAt: string }>();

  function releaseExpiredHolds() {
    for (const [key, hold] of holds) {
      if (new Date(hold.expiresAt).getTime() > Date.now()) continue;
      const table = tables.get(hold.tableId);

      if (table?.status === 'HELD') table.status = 'READY';
      holds.delete(key);
    }
  }

  return {
    async board(actor, branchId) {
      assertPermission(actor, 'queue:read'); assertBranchScope(actor, branchId);
      releaseExpiredHolds();

      return { tables: [...tables.values()], sessions: [...sessions.values()].filter((item) => item.branchId === branchId), cleaningTasks: [...tasks.values()].filter((item) => item.branchId === branchId), asOf: new Date().toISOString() };
    },
    async hold(actor, input, key) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId);
      const prior = holds.get(key);

 if (prior) return prior;
      const table = tables.get(input.tableId);
      assert(table?.status === 'READY', 'TABLE_NOT_READY', 'Table is not ready', 409);
      assert(input.partySize <= table.capacity && input.minutes >= 1 && input.minutes <= 30, 'VALIDATION_ERROR', 'Invalid hold policy');
      const hold = { id: `hold_${randomUUID()}`, tableId: table.id, expiresAt: new Date(Date.now() + input.minutes * 60_000).toISOString() };
      table.status = 'HELD'; holds.set(key, hold);

 return hold;
    },
    async seat(actor, input, key) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId);
      releaseExpiredHolds();
      const prior = replay.get(`seat:${key}`);

      if (prior && 'openedAt' in prior) return prior;
      const table = tables.get(input.tableId);
      assert(table && (table.status === 'READY' || table.status === 'HELD'), 'TABLE_NOT_READY', 'Table is not ready', 409);
      assert(input.partySize <= table.capacity, 'CAPACITY_EXCEEDED', 'Party does not fit this table', 409);
      assert(input.sourceType === 'WALK_IN' || Boolean(input.sourceId), 'VALIDATION_ERROR', 'Source ID is required');
      const session: ServiceSession = { id: `service_${randomUUID()}`, branchId: input.branchId, tableId: table.id, partySize: input.partySize, status: 'ACTIVE', sourceType: input.sourceType, sourceId: input.sourceId, openedBy: actor.id, openedAt: new Date().toISOString() };
      table.status = 'IN_USE';

      for (const [holdKey, hold] of holds) if (hold.tableId === table.id) holds.delete(holdKey);
      sessions.set(session.id, session); replay.set(`seat:${key}`, session);

      return session;
    },
    async vacate(actor, sessionId, key) {
      assertPermission(actor, 'queue:write');
      const prior = replay.get(`vacate:${key}`);

      if (prior && 'priority' in prior) return prior;
      const session = sessions.get(sessionId);
      assert(session, 'NOT_FOUND', 'Session not found', 404); assertBranchScope(actor, session.branchId);
      assert(session.status === 'ACTIVE', 'CONFLICT', 'Session already closed', 409);
      const table = tables.get(session.tableId); assert(table?.status === 'IN_USE', 'CONFLICT', 'Table is not in use', 409);
      session.status = 'CLOSED'; session.closedAt = new Date().toISOString(); table.status = 'WAITING_CLEANING';
      const task: CleaningTask = { id: `clean_${randomUUID()}`, branchId: session.branchId, tableId: table.id, sessionId, status: 'OPEN', priority: 'NORMAL', createdAt: new Date().toISOString() };
      tasks.set(task.id, task); replay.set(`vacate:${key}`, task);

 return task;
    },
    async transfer(actor, sessionId, tableId, key) {
      assertPermission(actor, 'queue:write'); const existing = replay.get(`transfer:${key}`);

      if (existing && 'openedAt' in existing) return existing;
      const current = sessions.get(sessionId); const target = tables.get(tableId);
      assert(current && target, 'NOT_FOUND', 'Session or table not found', 404); assertBranchScope(actor, current.branchId);
      assert(current.status === 'ACTIVE' && target.status === 'READY', 'CONFLICT', 'Transfer is not available', 409);
      assert(current.partySize <= target.capacity, 'CAPACITY_EXCEEDED', 'Party does not fit this table', 409);
      const source = tables.get(current.tableId);

      if (source) source.status = 'WAITING_CLEANING';
      target.status = 'IN_USE'; current.tableId = target.id; replay.set(`transfer:${key}`, current);

      if (source) {
        const taskId = `clean_${randomUUID()}`;
        tasks.set(taskId, { id: taskId, branchId: current.branchId, tableId: source.id, sessionId, status: 'OPEN', priority: 'NORMAL', createdAt: new Date().toISOString() });
      }

 return current;
    },
    async claimCleaning(actor, taskId, key) {
      assertPermission(actor, 'queue:write'); const prior = replay.get(`claim:${key}`);

      if (prior && 'priority' in prior) return prior;
      const task = tasks.get(taskId); assert(task, 'NOT_FOUND', 'Cleaning task not found', 404); assertBranchScope(actor, task.branchId);
      assert(task.status === 'OPEN', 'CONFLICT', 'Cleaning task is not open', 409);
      task.status = 'CLAIMED'; task.claimedBy = actor.id; const table = tables.get(task.tableId);

 if (table) table.status = 'CLEANING';
      replay.set(`claim:${key}`, task);

 return task;
    },
    async completeCleaning(actor, taskId, key) {
      assertPermission(actor, 'queue:write'); const prior = replay.get(`complete:${key}`);

      if (prior && 'priority' in prior) return prior;
      const task = tasks.get(taskId); assert(task, 'NOT_FOUND', 'Cleaning task not found', 404); assertBranchScope(actor, task.branchId);
      assert(task.status === 'CLAIMED', 'CONFLICT', 'Cleaning must be claimed first', 409);
      task.status = 'COMPLETE'; task.completedBy = actor.id; task.completedAt = new Date().toISOString();
      const table = tables.get(task.tableId);

 if (table) table.status = 'READY'; replay.set(`complete:${key}`, task);

 return task;
    }
  };
}
