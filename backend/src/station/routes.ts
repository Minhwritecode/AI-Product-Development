import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import { assert } from '../platform/errors.js';
import { actor, envelope, readIdempotencyKey } from '../platform/http.js';
import type { StationCode, StationRepository, TicketStatus } from './types.js';

export function registerStationRoutes(app: FastifyInstance, stationRepository: StationRepository, authenticate: onRequestHookHandler): void {
  app.get<{ Params: { station: string }; Querystring: { branchId: string; status?: TicketStatus } }>(
    '/api/v1/stations/:station/tickets',
    { preHandler: authenticate },
    async (request) => {
      assert(request.params.station === 'KITCHEN' || request.params.station === 'BAR', 'VALIDATION_ERROR', 'Station must be KITCHEN or BAR');
      const stationCode: StationCode = request.params.station === 'KITCHEN' ? 'KITCHEN' : 'BAR';

      return envelope(await stationRepository.listTickets(actor(request), request.query.branchId, stationCode, request.query.status), request.id);
    }
  );

  app.get<{ Params: { branchId: string } }>(
    '/api/v1/branches/:branchId/serving-queue',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.servingQueue(actor(request), request.params.branchId), request.id);
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    '/api/v1/tickets/:ticketId/accept',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.accept(actor(request), request.params.ticketId, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    '/api/v1/tickets/:ticketId/start',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.start(actor(request), request.params.ticketId, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    '/api/v1/tickets/:ticketId/ready',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.ready(actor(request), request.params.ticketId, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    '/api/v1/tickets/:ticketId/complete',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.ready(actor(request), request.params.ticketId, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string }; Body: { reason: string } }>(
    '/api/v1/tickets/:ticketId/delay',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.delay(actor(request), request.params.ticketId, request.body.reason, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string }; Body: { reason: string } }>(
    '/api/v1/tickets/:ticketId/reject',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.reject(actor(request), request.params.ticketId, request.body.reason, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    '/api/v1/tickets/:ticketId/pick-up',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.pickup(actor(request), request.params.ticketId, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    '/api/v1/tickets/:ticketId/serve',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await stationRepository.serve(actor(request), request.params.ticketId, readIdempotencyKey(request), request.id), request.id);
    }
  );
}
