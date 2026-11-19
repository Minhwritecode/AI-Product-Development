import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import { assert } from '../platform/errors.js';
import { actor, envelope, readBody, readGuestAccessToken, readIdempotencyKey } from '../platform/http.js';
import type { CreateQueueInput, CreateReservationInput, FohRepository } from './types.js';

const reservationSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'partySize', 'reservedFor', 'language'],
    properties: {
      branchId: { type: 'string', minLength: 1 },
      partySize: { type: 'integer', minimum: 1, maximum: 20 },
      reservedFor: { type: 'string', format: 'date-time' },
      durationMinutes: { type: 'integer', minimum: 15, maximum: 360 },
      language: { type: 'string', enum: ['vi', 'en'] },
      nickname: { type: 'string', maxLength: 60 }
    },
    additionalProperties: false
  }
} as const;

export function registerFohRoutes(app: FastifyInstance, fohRepository: FohRepository, authenticate: onRequestHookHandler): void {
  app.get<{ Querystring: { branchId: string } }>('/api/v1/guest/front-door/status', async (request) => {
    return envelope(await fohRepository.getFrontDoorStatus(request.query.branchId), request.id);
  });

  app.post<{ Body: CreateQueueInput }>(
    '/api/v1/guest/queues',
    {
      schema: {
        body: {
          type: 'object',
          required: ['branchId', 'partySize', 'timeBudgetMinutes', 'language'],
          properties: {
            branchId: { type: 'string' },
            partySize: { type: 'integer', minimum: 1, maximum: 20 },
            timeBudgetMinutes: { type: 'integer', minimum: 15, maximum: 180 },
            language: { type: 'string', enum: ['vi', 'en'] },
            nickname: { type: 'string', maxLength: 60 },
            notificationOptIn: { type: 'boolean' },
            contact: { type: 'string', maxLength: 160 }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      return reply.code(201).send(envelope(await fohRepository.joinQueue(request.body, readIdempotencyKey(request)), request.id));
    }
  );

  app.get<{ Params: { queueId: string } }>('/api/v1/guest/queues/:queueId', async (request) => {
    return envelope(await fohRepository.getQueueEntry(request.params.queueId, readGuestAccessToken(request)), request.id);
  });

  app.post<{ Params: { queueId: string } }>('/api/v1/guest/queues/:queueId/leave', async (request) => {
    return envelope(await fohRepository.leaveQueue(request.params.queueId, readGuestAccessToken(request), readIdempotencyKey(request)), request.id);
  });

  app.get<{ Querystring: { branchId: string } }>('/api/v1/foh/queues', { preHandler: authenticate }, async (request) => {
    return envelope(await fohRepository.listQueue(actor(request), request.query.branchId), request.id);
  });

  app.post<{ Params: { queueId: string; command: 'call' | 'seat' | 'cancel' | 'expire' }; Body: { reason?: string } }>(
    '/api/v1/foh/queues/:queueId/:command',
    { preHandler: authenticate },
    async (request) => {
      assert(['call', 'seat', 'cancel', 'expire'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported queue command');

      return envelope(await fohRepository.commandQueue(actor(request), request.params.queueId, request.params.command, request.id, readBody<{ reason?: string }>(request).reason), request.id);
    }
  );

  app.patch<{ Params: { branchId: string }; Body: { state: 'OPEN' | 'PAUSED' | 'FULL' | 'CLOSED'; reason: string } }>(
    '/api/v1/branches/:branchId/operating-state',
    { preHandler: authenticate },
    async (request) => {
      return envelope(await fohRepository.setOperatingState(actor(request), request.params.branchId, request.body.state, request.body.reason, request.id), request.id);
    }
  );

  app.get<{ Querystring: { branchId: string; date?: string } }>('/api/v1/reservations', { preHandler: authenticate }, async (request) => {
    return envelope(await fohRepository.listReservations(actor(request), request.query.branchId, request.query.date), request.id);
  });

  app.post<{ Body: CreateReservationInput }>('/api/v1/reservations', { preHandler: authenticate, schema: reservationSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await fohRepository.createReservation(actor(request), readBody<CreateReservationInput>(request), readIdempotencyKey(request), request.id), request.id));
  });

  app.post<{ Params: { reservationId: string; command: 'confirm' | 'arrive' | 'cancel' | 'no-show' } }>(
    '/api/v1/reservations/:reservationId/:command',
    { preHandler: authenticate },
    async (request) => {
      assert(['confirm', 'arrive', 'cancel', 'no-show'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported reservation command');

      return envelope(await fohRepository.commandReservation(actor(request), request.params.reservationId, request.params.command, readIdempotencyKey(request), request.id), request.id);
    }
  );
}
