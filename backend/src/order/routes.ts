import { randomUUID } from 'node:crypto';
import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import { assert } from '../platform/errors.js';
import { actor, envelope, readIdempotencyKey, readTableToken } from '../platform/http.js';
import type { StationRepository } from '../station/types.js';
import type { OrderRepository } from './types.js';

export function registerOrderRoutes(
  app: FastifyInstance,
  orderRepository: OrderRepository,
  authenticate: onRequestHookHandler,
  stationRepository?: StationRepository
): void {
  app.post<{ Params: { tableId: string } }>('/api/v1/tables/:tableId/qr-token', { preHandler: authenticate }, async (request) => {
    return envelope(await orderRepository.issueTableToken(actor(request), request.params.tableId, request.id), request.id);
  });

  app.get('/api/v1/guest/table-menu', async (request) => {
    return envelope(await orderRepository.guestMenu(readTableToken(request)), request.id);
  });

  app.post<{
    Body: {
      lines: Array<{
        menuItemId: string;
        quantity: number;
        modifierOptionIds?: string[];
        allergenNote?: string;
        guestNote?: string;
      }>;
    };
  }>('/api/v1/guest/table-requests', async (request, reply) => {
    return reply.code(201).send(envelope(await orderRepository.submitGuestRequest(readTableToken(request), request.body.lines, readIdempotencyKey(request)), request.id));
  });

  app.get<{ Querystring: { branchId: string } }>('/api/v1/foh/requests', { preHandler: authenticate }, async (request) => {
    return envelope(await orderRepository.listRequests(actor(request), request.query.branchId), request.id);
  });

  app.post<{ Params: { requestId: string; command: 'acknowledge' | 'reject' | 'complete' } }>(
    '/api/v1/foh/requests/:requestId/:command',
    { preHandler: authenticate },
    async (request) => {
      assert(['acknowledge', 'reject', 'complete'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported request command');

      return envelope(await orderRepository.commandRequest(actor(request), request.params.requestId, request.params.command, readIdempotencyKey(request), request.id), request.id);
    }
  );

  app.post<{
    Params: { sessionId: string };
    Body: {
      branchId: string;
      coursePolicy: 'AS_READY' | 'SERVE_TOGETHER';
      lines: Array<{
        menuItemId: string;
        quantity: number;
        modifierOptionIds?: string[];
        allergenNote?: string;
        guestNote?: string;
      }>;
    };
  }>('/api/v1/service-sessions/:sessionId/orders', { preHandler: authenticate }, async (request, reply) => {
    return reply.code(201).send(
      envelope(
        await orderRepository.createDraft(
          actor(request),
          { ...request.body, serviceSessionId: request.params.sessionId },
          readIdempotencyKey(request),
          request.id
        ),
        request.id
      )
    );
  });

  app.patch<{
    Params: { orderId: string };
    Body: {
      coursePolicy: 'AS_READY' | 'SERVE_TOGETHER';
      lines: Array<{
        menuItemId: string;
        quantity: number;
        modifierOptionIds?: string[];
        allergenNote?: string;
        guestNote?: string;
      }>;
    };
  }>('/api/v1/orders/:orderId', { preHandler: authenticate }, async (request) => {
    return envelope(await orderRepository.updateDraft(actor(request), request.params.orderId, request.body, readIdempotencyKey(request), request.id), request.id);
  });

  app.post<{ Params: { orderId: string } }>('/api/v1/orders/:orderId/send', { preHandler: authenticate }, async (request) => {
    const result = await orderRepository.send(actor(request), request.params.orderId, readIdempotencyKey(request), request.id);

    if (stationRepository?.createTicketDirect) {
      for (const stationCode of ['KITCHEN', 'BAR'] as const) {
        const stationLines = result.lines.filter((line) => line.stationCode === stationCode);

        if (!stationLines.length) continue;
        stationRepository.createTicketDirect({
          id: `ticket_${randomUUID()}`,
          orderId: result.id,
          branchId: result.branchId,
          stationCode,
          status: 'NEW',
          tableLabel: 'T01',
          roundNumber: result.roundNumber,
          coursePolicy: result.coursePolicy,
          lines: stationLines,
          createdAt: new Date().toISOString()
        });
      }
    }

    return envelope(result, request.id);
  });
}
