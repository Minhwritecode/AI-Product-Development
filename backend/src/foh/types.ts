import type { Actor } from '../platform/types.js';

export type OperatingState = 'OPEN' | 'PAUSED' | 'FULL' | 'CLOSED';

export type QueueEntryStatus = 'WAITING' | 'CALLED' | 'SEATED' | 'LEFT' | 'CANCELLED' | 'EXPIRED';

export type ReservationStatus = 'HELD' | 'CONFIRMED' | 'ARRIVED' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED';

export type GuestLanguage = 'vi' | 'en';

export type WaitEstimate = { min: number; max: number; unit: 'MINUTES' };

export type FrontDoorStatus = { branchId: string; operatingState: OperatingState; availableTables: number; queueSize: number; queueCapacity: number; estimatedWait: WaitEstimate; asOf: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; limitations: string[] };

export type QueueEntry = { id: string; branchId: string; queueCode: string; accessToken: string; status: QueueEntryStatus; partySize: number; timeBudgetMinutes: number; language: GuestLanguage; nickname?: string; notificationOptIn: boolean; createdAt: string; calledAt?: string; completedAt?: string };

export type Reservation = { id: string; branchId: string; status: ReservationStatus; partySize: number; reservedFor: string; durationMinutes: number; holdUntil?: string; language: GuestLanguage; nickname?: string; createdAt: string; updatedAt: string };

export type CreateQueueInput = { branchId: string; partySize: number; timeBudgetMinutes: number; language: GuestLanguage; nickname?: string; notificationOptIn?: boolean; contact?: string };

export type CreateReservationInput = { branchId: string; partySize: number; reservedFor: string; durationMinutes?: number; language: GuestLanguage; nickname?: string };

export type FohRepository = {
  getFrontDoorStatus(branchId: string): Promise<FrontDoorStatus>;
  joinQueue(input: CreateQueueInput, idempotencyKey: string): Promise<QueueEntry>;
  getQueueEntry(queueId: string, accessToken: string): Promise<QueueEntry>;
  leaveQueue(queueId: string, accessToken: string, idempotencyKey: string): Promise<QueueEntry>;
  listQueue(actor: Actor, branchId: string): Promise<QueueEntry[]>;
  commandQueue(actor: Actor, queueId: string, command: 'call' | 'seat' | 'cancel' | 'expire', requestId: string, reason?: string): Promise<QueueEntry>;
  listReservations(actor: Actor, branchId: string, date?: string): Promise<Reservation[]>;
  createReservation(actor: Actor, input: CreateReservationInput, idempotencyKey: string, requestId: string): Promise<Reservation>;
  commandReservation(actor: Actor, reservationId: string, command: 'confirm' | 'arrive' | 'cancel' | 'no-show', idempotencyKey: string, requestId: string): Promise<Reservation>;
  setOperatingState(actor: Actor, branchId: string, state: OperatingState, reason: string, requestId: string): Promise<FrontDoorStatus>;
};
