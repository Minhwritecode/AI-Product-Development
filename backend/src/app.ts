import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { createMemoryFloorRepository } from './floor/memory-repository.js';
import { registerFloorRoutes } from './floor/routes.js';
import type { FloorRepository } from './floor/types.js';
import { createMemoryFohRepository } from './foh/memory-repository.js';
import { registerFohRoutes } from './foh/routes.js';
import type { FohRepository } from './foh/types.js';
import { createMemoryOperationsRepository } from './operations/memory-repository.js';
import { registerOperationsRoutes } from './operations/routes.js';
import type { OperationsRepository } from './operations/types.js';
import { createMemoryOrderRepository } from './order/memory-repository.js';
import { registerOrderRoutes } from './order/routes.js';
import type { OrderRepository } from './order/types.js';
import { AppError, assert } from './platform/errors.js';
import { envelope } from './platform/http.js';
import { createMemoryRepository } from './platform/memory-repository.js';
import { registerPlatformRoutes } from './platform/routes.js';
import type { PlatformRepository } from './platform/types.js';
import { createMemoryStationRepository } from './station/memory-repository.js';
import { registerStationRoutes } from './station/routes.js';
import type { StationRepository } from './station/types.js';

type JwtPayload = { sub: string; sid: string };

export type AppOptions = {
  repository?: PlatformRepository;
  operationsRepository?: OperationsRepository;
  fohRepository?: FohRepository;
  floorRepository?: FloorRepository;
  orderRepository?: OrderRepository;
  stationRepository?: StationRepository;
  jwtSecret?: string;
  databaseStatus?: () => Promise<'ok' | 'unavailable' | 'not-configured'>;
};

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, requestIdHeader: 'x-request-id' });
  const repository = options.repository ?? createMemoryRepository();
  const operationsRepository = options.operationsRepository ?? createMemoryOperationsRepository();
  const fohRepository = options.fohRepository ?? createMemoryFohRepository();
  const floorRepository = options.floorRepository ?? createMemoryFloorRepository();
  const orderRepository = options.orderRepository ?? createMemoryOrderRepository();
  const stationRepository = options.stationRepository ?? createMemoryStationRepository();
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? 'luminex-local-development-secret';

  app.register(cors, { origin: true });
  app.register(fastifyJwt, { secret: jwtSecret });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ data: null, meta: { requestId: request.id }, error: { code: error.code, message: error.message, fields: error.fields } });
    }

    if (error instanceof Error && 'validation' in error) {
      return reply.code(422).send({ data: null, meta: { requestId: request.id }, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', fields: {} } });
    }

    request.log.error(error);

    return reply.code(500).send({ data: null, meta: { requestId: request.id }, error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', fields: {} } });
  });

  async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    try {
      await request.jwtVerify<JwtPayload>();
      // SAFETY: @fastify/jwt verifies the signature and the route only signs JwtPayload values.
      const payload = request.user as JwtPayload;
      assert(payload.sub && payload.sid, 'UNAUTHENTICATED', 'Authentication required', 401);
      assert(!(await repository.isSessionRevoked(payload.sid)), 'SESSION_REVOKED', 'Session is no longer active', 401);
      const currentActor = await repository.findActor(payload.sub);
      assert(currentActor, 'UNAUTHENTICATED', 'Authentication required', 401);
      request.actor = currentActor;
      request.sessionId = payload.sid;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
    }
  }

  // System & Health endpoints
  app.get('/health', async (request) => envelope({ status: 'ok', service: 'luminex-backend', version: 'platform-foundation' }, request.id));

  app.get('/ready', async (request, reply) => {
    const postgres = options.databaseStatus ? await options.databaseStatus() : 'not-configured';
    const ready = postgres === 'ok';

    return reply.code(ready ? 200 : 503).send(envelope({ status: ready ? 'ready' : 'degraded', dependencies: { postgres } }, request.id));
  });

  app.get('/api/v1', async (request) => envelope({ name: 'Luminex API', version: 'v1', status: 'platform-foundation' }, request.id));

  // Domain routes
  registerPlatformRoutes(app, repository, authenticate);
  registerOperationsRoutes(app, operationsRepository, repository, authenticate);
  registerFohRoutes(app, fohRepository, authenticate);
  registerFloorRoutes(app, floorRepository, authenticate);
  registerOrderRoutes(app, orderRepository, authenticate, stationRepository);
  registerStationRoutes(app, stationRepository, authenticate);

  return app;
}
