import type { Actor } from '../platform/types.js';

export type FloorTable = { id: string; areaId: string; label: string; capacity: number; accessibilityTags: string[]; status: 'READY' | 'HELD' | 'BLOCKED' | 'MAINTENANCE' | 'INACTIVE' | 'IN_USE' | 'WAITING_CLEANING' | 'CLEANING' };

export type ServiceSession = { id: string; branchId: string; tableId: string; partySize: number; status: 'ACTIVE' | 'CLOSED'; sourceType: 'WALK_IN' | 'QUEUE' | 'RESERVATION'; sourceId?: string; openedBy: string; openedAt: string; closedAt?: string };

export type CleaningTask = { id: string; branchId: string; tableId: string; sessionId?: string; status: 'OPEN' | 'CLAIMED' | 'COMPLETE'; priority: 'NORMAL' | 'HIGH'; claimedBy?: string; completedBy?: string; createdAt: string; completedAt?: string };

export type FloorBoard = { tables: FloorTable[]; sessions: ServiceSession[]; cleaningTasks: CleaningTask[]; asOf: string };

export type FloorRepository = {
  board(actor: Actor, branchId: string): Promise<FloorBoard>;
  hold(actor: Actor, input: { branchId: string; tableId: string; partySize: number; minutes: number }, key: string, requestId: string): Promise<{ id: string; tableId: string; expiresAt: string }>;
  seat(actor: Actor, input: { branchId: string; tableId: string; partySize: number; sourceType: ServiceSession['sourceType']; sourceId?: string }, key: string, requestId: string): Promise<ServiceSession>;
  vacate(actor: Actor, sessionId: string, key: string, requestId: string): Promise<CleaningTask>;
  transfer(actor: Actor, sessionId: string, tableId: string, key: string, requestId: string): Promise<ServiceSession>;
  claimCleaning(actor: Actor, taskId: string, key: string, requestId: string): Promise<CleaningTask>;
  completeCleaning(actor: Actor, taskId: string, key: string, requestId: string): Promise<CleaningTask>;
};
