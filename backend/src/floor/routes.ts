import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import { actor, envelope, readIdempotencyKey } from '../platform/http.js';
import type { FloorRepository, ServiceSession } from './types.js';

export function registerFloorRoutes(app: FastifyInstance, floorRepository: FloorRepository, authenticate: onRequestHookHandler): void {
  app.get<{ Params: { branchId: string } }>('/api/v1/branches/:branchId/floor', { preHandler: authenticate }, async (request) => {
    return envelope(await floorRepository.board(actor(request), request.params.branchId), request.id);
  });

  app.post<{ Body: { branchId: string; tableId: string; partySize: number; minutes: number } }>(
    '/api/v1/table-holds',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await floorRepository.hold(actor(request), request.body, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Body: { branchId: string; tableId: string; partySize: number; sourceType: ServiceSession['sourceType']; sourceId?: string } }>(
    '/api/v1/service-sessions',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['branchId', 'tableId', 'partySize', 'sourceType'],
          properties: {
            branchId: { type: 'string', minLength: 1 },
            tableId: { type: 'string', minLength: 1 },
            partySize: { type: 'integer', minimum: 1, maximum: 30 },
            sourceType: { type: 'string', enum: ['WALK_IN', 'QUEUE', 'RESERVATION'] },
            sourceId: { type: 'string', minLength: 1 }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      return reply.code(201).send(envelope(await floorRepository.seat(actor(request), request.body, readIdempotencyKey(request), request.id), request.id));
    }
  );

  app.post<{ Params: { sessionId: string } }>('/api/v1/service-sessions/:sessionId/vacate', { preHandler: authenticate }, async (request) => {
    return envelope(await floorRepository.vacate(actor(request), request.params.sessionId, readIdempotencyKey(request), request.id), request.id);
  });

  app.post<{ Params: { sessionId: string }; Body: { tableId: string } }>(
    '/api/v1/service-sessions/:sessionId/transfer',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await floorRepository.transfer(actor(request), request.params.sessionId, request.body.tableId, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{ Params: { taskId: string } }>('/api/v1/cleaning-tasks/:taskId/claim', { preHandler: authenticate }, async (request) => {
    return envelope(await floorRepository.claimCleaning(actor(request), request.params.taskId, readIdempotencyKey(request), request.id), request.id);
  });

  app.post<{ Params: { taskId: string } }>('/api/v1/cleaning-tasks/:taskId/complete', { preHandler: authenticate }, async (request) => {
    return envelope(await floorRepository.completeCleaning(actor(request), request.params.taskId, readIdempotencyKey(request), request.id), request.id);
  });
}
