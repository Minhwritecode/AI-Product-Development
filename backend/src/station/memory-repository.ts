import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { StationRepository, StationTicket } from './types.js';

export function createMemoryStationRepository(): StationRepository {
  const tickets = new Map<string, StationTicket>();
  const replay = new Map<string, StationTicket>();

  return {
    async listTickets(actor, branchId, stationCode, status) {
      assertPermission(actor, 'queue:read');
      assertBranchScope(actor, branchId);

      return [...tickets.values()]
        .filter((t) => t.branchId === branchId)
        .filter((t) => (stationCode ? t.stationCode === stationCode : true))
        .filter((t) => (status ? t.status === status : true))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    async servingQueue(actor, branchId) {
      assertPermission(actor, 'queue:read');
      assertBranchScope(actor, branchId);

      return [...tickets.values()]
        .filter((t) => t.branchId === branchId && (t.status === 'READY' || t.status === 'PICKED_UP'))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    async accept(actor, ticketId, key) {
      assertPermission(actor, 'queue:write');
      const prior = replay.get(`accept:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(ticket.status === 'NEW', 'CONFLICT', `Cannot accept ticket in status ${ticket.status}`, 409);

      ticket.status = 'ACCEPTED';
      ticket.acceptedBy = actor.id;
      ticket.acceptedAt = new Date().toISOString();
      replay.set(`accept:${key}`, ticket);

      return ticket;
    },

    async start(actor, ticketId, key) {
      assertPermission(actor, 'queue:write');
      const prior = replay.get(`start:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(ticket.status === 'ACCEPTED' || ticket.status === 'NEW', 'CONFLICT', `Cannot start ticket in status ${ticket.status}`, 409);

      ticket.status = 'PREPARING';
      ticket.preparedBy = actor.id;
      ticket.preparedAt = new Date().toISOString();
      replay.set(`start:${key}`, ticket);

      return ticket;
    },

    async ready(actor, ticketId, key) {
      assertPermission(actor, 'queue:write');
      const prior = replay.get(`ready:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(ticket.status === 'PREPARING' || ticket.status === 'ACCEPTED', 'CONFLICT', `Cannot complete ticket in status ${ticket.status}`, 409);

      ticket.status = 'READY';

      if (!ticket.preparedAt) ticket.preparedAt = new Date().toISOString();

      if (!ticket.preparedBy) ticket.preparedBy = actor.id;
      replay.set(`ready:${key}`, ticket);

      return ticket;
    },

    async delay(actor, ticketId, reason, key) {
      assertPermission(actor, 'queue:write');
      assert(reason.trim().length > 0, 'VALIDATION_ERROR', 'Delay reason is required');
      const prior = replay.get(`delay:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(['NEW', 'ACCEPTED', 'PREPARING'].includes(ticket.status), 'CONFLICT', `Cannot delay ticket in status ${ticket.status}`, 409);

      ticket.status = 'DELAYED';
      ticket.delayedAt = new Date().toISOString();
      ticket.delayReason = reason.trim();
      replay.set(`delay:${key}`, ticket);

      return ticket;
    },

    async reject(actor, ticketId, reason, key) {
      assertPermission(actor, 'queue:write');
      assert(reason.trim().length > 0, 'VALIDATION_ERROR', 'Reject reason is required');
      const prior = replay.get(`reject:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(['NEW', 'ACCEPTED', 'DELAYED'].includes(ticket.status), 'CONFLICT', `Cannot reject ticket in status ${ticket.status}`, 409);

      ticket.status = 'REJECTED';
      ticket.rejectedAt = new Date().toISOString();
      ticket.rejectReason = reason.trim();
      replay.set(`reject:${key}`, ticket);

      return ticket;
    },

    async pickup(actor, ticketId, key) {
      assertPermission(actor, 'queue:write');
      const prior = replay.get(`pickup:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(ticket.status === 'READY', 'CONFLICT', `Cannot pickup ticket in status ${ticket.status}`, 409);

      ticket.status = 'PICKED_UP';
      ticket.pickedUpBy = actor.id;
      ticket.pickedUpAt = new Date().toISOString();
      replay.set(`pickup:${key}`, ticket);

      return ticket;
    },

    async serve(actor, ticketId, key) {
      assertPermission(actor, 'queue:write');
      const prior = replay.get(`serve:${key}`);

      if (prior) return prior;

      const ticket = tickets.get(ticketId);
      assert(ticket, 'NOT_FOUND', 'Ticket not found', 404);
      assertBranchScope(actor, ticket.branchId);
      assert(ticket.status === 'PICKED_UP' || ticket.status === 'READY', 'CONFLICT', `Cannot serve ticket in status ${ticket.status}`, 409);

      ticket.status = 'SERVED';
      ticket.servedBy = actor.id;
      ticket.servedAt = new Date().toISOString();
      replay.set(`serve:${key}`, ticket);

      return ticket;
    },

    createTicketDirect(ticket: StationTicket) {
      tickets.set(ticket.id, ticket);
    }
  };
}
