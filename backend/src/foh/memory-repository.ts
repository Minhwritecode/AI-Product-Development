import { randomUUID } from 'node:crypto';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { CreateQueueInput, CreateReservationInput, FohRepository, FrontDoorStatus, OperatingState, QueueEntry, Reservation } from './types.js';

export function createMemoryFohRepository(): FohRepository {
  const entries = new Map<string, QueueEntry>();
  const reservations = new Map<string, Reservation>();
  const queueIdempotency = new Map<string, QueueEntry>();
  const reservationIdempotency = new Map<string, Reservation>();
  const operatingStates = new Map<string, { state: OperatingState; reason: string }>([['branch_central', { state: 'OPEN', reason: 'Service đang mở' }]]);

  function status(branchId: string): FrontDoorStatus {
    const state = operatingStates.get(branchId)?.state ?? 'CLOSED';
    const queue = [...entries.values()].filter((entry) => entry.branchId === branchId && ['WAITING', 'CALLED'].includes(entry.status));
    const availableTables = state === 'OPEN' ? 3 : 0;
    const baseWait = 15 + queue.length * 10;

    return { branchId, operatingState: state, availableTables, queueSize: queue.length, queueCapacity: 40, estimatedWait: { min: availableTables > 0 ? 0 : baseWait, max: availableTables > 0 ? 15 : baseWait + 20, unit: 'MINUTES' }, asOf: new Date().toISOString(), confidence: queue.length < 20 ? 'MEDIUM' : 'LOW', limitations: ['Estimated wait is a range, not a promise.', 'The system does not predict the exact time a guest leaves a table.'] };
  }

  function copyEntry(entry: QueueEntry): QueueEntry { return { ...entry }; }

  function copyReservation(reservation: Reservation): Reservation { return { ...reservation }; }

  function expireReservations(branchId?: string) {
    const now = Date.now();
    reservations.forEach((reservation) => {
      if ((!branchId || reservation.branchId === branchId) && reservation.status === 'HELD' && reservation.holdUntil && Date.parse(reservation.holdUntil) <= now) {
        reservation.status = 'EXPIRED';
        reservation.updatedAt = new Date(now).toISOString();
      }
    });
  }

  function overlaps(left: Reservation, rightStart: number, rightDurationMinutes: number): boolean {
    const leftStart = Date.parse(left.reservedFor);
    const leftEnd = leftStart + left.durationMinutes * 60_000;
    const rightEnd = rightStart + rightDurationMinutes * 60_000;

    return leftStart < rightEnd && rightStart < leftEnd;
  }

  const repository: FohRepository = {
    async getFrontDoorStatus(branchId) { return status(branchId); },

    async joinQueue(input: CreateQueueInput, idempotencyKey) {
      const previous = queueIdempotency.get(idempotencyKey);

      if (previous) return copyEntry(previous);

      const current = status(input.branchId);

      assert(current.operatingState === 'OPEN', 'QUEUE_NOT_OPEN', 'Queue is not accepting guests', 409);
      assert(input.partySize >= 1 && input.partySize <= 20, 'VALIDATION_ERROR', 'Party size must be between 1 and 20');
      assert(input.timeBudgetMinutes >= 15 && input.timeBudgetMinutes <= 180, 'VALIDATION_ERROR', 'Time budget must be between 15 and 180 minutes');
      assert(!input.notificationOptIn || Boolean(input.contact?.trim()), 'VALIDATION_ERROR', 'Contact is required when notifications are enabled');
      assert(current.queueSize < current.queueCapacity, 'QUEUE_FULL', 'Queue is full', 409);
      const entry: QueueEntry = { id: `queue_${randomUUID().slice(0, 8)}`, branchId: input.branchId, queueCode: `L${Math.floor(Math.random() * 900 + 100)}`, accessToken: randomUUID(), status: 'WAITING', partySize: input.partySize, timeBudgetMinutes: input.timeBudgetMinutes, language: input.language, nickname: input.nickname?.trim() || undefined, notificationOptIn: input.notificationOptIn ?? false, createdAt: new Date().toISOString() };
      entries.set(entry.id, entry);
      queueIdempotency.set(idempotencyKey, entry);

      return copyEntry(entry);
    },

    async getQueueEntry(queueId, accessToken) {
      const entry = entries.get(queueId);

      assert(entry && entry.accessToken === accessToken, 'NOT_FOUND', 'Queue entry not found', 404);

      return copyEntry(entry);
    },

    async leaveQueue(queueId, accessToken, idempotencyKey) {
      const previous = queueIdempotency.get(`leave:${idempotencyKey}`);

      if (previous) return copyEntry(previous);

      const entry = entries.get(queueId);

      assert(entry && entry.accessToken === accessToken, 'NOT_FOUND', 'Queue entry not found', 404);
      assert(['WAITING', 'CALLED'].includes(entry.status), 'CONFLICT', 'Queue entry cannot be left in this state', 409);
      entry.status = 'LEFT';
      entry.completedAt = new Date().toISOString();
      queueIdempotency.set(`leave:${idempotencyKey}`, entry);

      return copyEntry(entry);
    },

    async listQueue(actor, branchId) {
      assertPermission(actor, 'queue:read');
      assertBranchScope(actor, branchId);

      return [...entries.values()].flatMap((entry) => entry.branchId === branchId ? [copyEntry({ ...entry, accessToken: '' })] : []);
    },

    async listReservations(actor, branchId, date) {
      assertPermission(actor, 'reservation:read');
      assertBranchScope(actor, branchId);
      expireReservations(branchId);

      return [...reservations.values()]
        .filter((reservation) => reservation.branchId === branchId && (!date || reservation.reservedFor.startsWith(date)))
        .sort((left, right) => left.reservedFor.localeCompare(right.reservedFor))
        .map(copyReservation);
    },

    async commandQueue(actor, queueId, command, _requestId, reason) {
      assertPermission(actor, 'queue:write');
      const entry = entries.get(queueId);

      assert(entry, 'NOT_FOUND', 'Queue entry not found', 404);
      assertBranchScope(actor, entry.branchId);
      assert(command !== 'cancel' || Boolean(reason?.trim()), 'VALIDATION_ERROR', 'Cancellation reason is required');
      assert((command === 'call' && entry.status === 'WAITING') || (command === 'seat' && entry.status === 'CALLED') || (command === 'cancel' && ['WAITING', 'CALLED'].includes(entry.status)) || (command === 'expire' && ['WAITING', 'CALLED'].includes(entry.status)), 'CONFLICT', 'Queue entry cannot transition from this state', 409);

      if (command === 'call') entry.status = 'CALLED';

      if (command === 'seat') { entry.status = 'SEATED'; entry.completedAt = new Date().toISOString(); }

      if (command === 'cancel') entry.status = 'CANCELLED';

      if (command === 'expire') entry.status = 'EXPIRED';

      return copyEntry({ ...entry, accessToken: '' });
    },

    async createReservation(actor, input: CreateReservationInput, idempotencyKey) {
      assertPermission(actor, 'reservation:write');
      assertBranchScope(actor, input.branchId);
      assert(input.partySize >= 1 && input.partySize <= 20, 'VALIDATION_ERROR', 'Party size must be between 1 and 20');
      assert(Number.isFinite(new Date(input.reservedFor).getTime()), 'VALIDATION_ERROR', 'Reservation time is invalid');
      const durationMinutes = input.durationMinutes ?? 90;
      assert(durationMinutes >= 15 && durationMinutes <= 360, 'VALIDATION_ERROR', 'Reservation duration must be between 15 and 360 minutes');
      const previous = reservationIdempotency.get(`create:${idempotencyKey}`);

      if (previous) return copyReservation(previous);

      expireReservations(input.branchId);
      const reservedAt = Date.parse(input.reservedFor);
      const active = [...reservations.values()].filter((reservation) => reservation.branchId === input.branchId && ['HELD', 'CONFIRMED', 'ARRIVED'].includes(reservation.status) && overlaps(reservation, reservedAt, durationMinutes));
      assert(active.length < status(input.branchId).availableTables, 'RESERVATION_UNAVAILABLE', 'No reservation capacity for this time', 409);
      const now = new Date();
      const reservation: Reservation = { id: `reservation_${randomUUID().slice(0, 8)}`, branchId: input.branchId, status: 'HELD', partySize: input.partySize, reservedFor: input.reservedFor, durationMinutes, holdUntil: new Date(now.getTime() + 10 * 60_000).toISOString(), language: input.language, nickname: input.nickname?.trim() || undefined, createdAt: now.toISOString(), updatedAt: now.toISOString() };
      reservations.set(reservation.id, reservation);
      reservationIdempotency.set(`create:${idempotencyKey}`, reservation);

      return copyReservation(reservation);
    },

    async commandReservation(actor, reservationId, command, idempotencyKey) {
      assertPermission(actor, 'reservation:write');
      const previous = reservationIdempotency.get(`command:${idempotencyKey}`);

      if (previous) return copyReservation(previous);

      const reservation = reservations.get(reservationId);

      assert(reservation, 'NOT_FOUND', 'Reservation not found', 404);
      assertBranchScope(actor, reservation.branchId);
      expireReservations(reservation.branchId);
      const next: Record<typeof command, Reservation['status']> = { confirm: 'CONFIRMED', arrive: 'ARRIVED', cancel: 'CANCELLED', 'no-show': 'NO_SHOW' };
      const allowed: Record<Reservation['status'], Reservation['status'][]> = { HELD: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'], ARRIVED: [], CANCELLED: [], NO_SHOW: [], EXPIRED: [] };

      assert(allowed[reservation.status].includes(next[command]), 'CONFLICT', 'Reservation cannot transition from this state', 409);
      reservation.status = next[command];
      reservation.updatedAt = new Date().toISOString();
      reservationIdempotency.set(`command:${idempotencyKey}`, reservation);

      return copyReservation(reservation);
    },

    async setOperatingState(actor, branchId, state, reason) {
      assertPermission(actor, 'queue:write');
      assertBranchScope(actor, branchId);
      assert(reason.trim().length >= 3, 'VALIDATION_ERROR', 'Operating state reason is required');
      operatingStates.set(branchId, { state, reason: reason.trim() });

      return status(branchId);
    }
  };

  return repository;
}
