import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { AppError, assert, assertPermission } from './platform/errors.js';
import { createMemoryRepository } from './platform/memory-repository.js';
import type { Actor, PlatformRepository } from './platform/types.js';

type JwtPayload = { sub: string; sid: string };

type AppOptions = {
  repository?: PlatformRepository;
  jwtSecret?: string;
  databaseStatus?: () => Promise<'ok' | 'unavailable' | 'not-configured'>;
};

const loginSchema = { body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } }, additionalProperties: false } } as const;

const restaurantSchema = { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2 }, defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 }, defaultLocale: { type: 'string' } }, additionalProperties: false } } as const;

const branchSchema = { body: { type: 'object', required: ['name', 'code'], properties: { name: { type: 'string', minLength: 2 }, code: { type: 'string', pattern: '^[A-Z0-9_-]{2,24}$' }, timezone: { type: 'string' }, currency: { type: 'string', minLength: 3, maxLength: 3 }, locale: { type: 'string' }, serviceHours: { type: 'object' } }, additionalProperties: false } } as const;

const areaSchema = { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2 }, sortOrder: { type: 'integer', minimum: 1 } }, additionalProperties: false } } as const;

const tableSchema = { body: { type: 'object', required: ['label', 'capacity'], properties: { label: { type: 'string', minLength: 1 }, capacity: { type: 'integer', minimum: 1, maximum: 30 }, accessibilityTags: { type: 'array', items: { type: 'string' } } }, additionalProperties: false } } as const;

declare module 'fastify' {
  interface FastifyRequest {
    actor?: Actor;
    sessionId?: string;
  }
}

function envelope<T>(data: T, requestId: string) {
  return { data, meta: { requestId }, error: null };
}

function readBody<T>(request: FastifyRequest): T {
  // SAFETY: Each command route declares a Fastify JSON schema before this boundary; an absent body is treated as an empty invalid input.
  return (request.body ?? {}) as T;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, requestIdHeader: 'x-request-id' });
  const repository = options.repository ?? createMemoryRepository();
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

  function actor(request: FastifyRequest): Actor {
    assert(request.actor, 'UNAUTHENTICATED', 'Authentication required', 401);

    return request.actor;
  }

  app.get('/health', async (request) => envelope({ status: 'ok', service: 'luminex-backend', version: 'platform-foundation' }, request.id));

  app.get('/ready', async (request, reply) => {
    const postgres = options.databaseStatus ? await options.databaseStatus() : 'not-configured';
    const ready = postgres !== 'unavailable';

    return reply.code(ready ? 200 : 503).send(envelope({ status: ready ? 'ready' : 'degraded', dependencies: { postgres } }, request.id));
  });

  app.get('/api/v1', async (request) => envelope({ name: 'Luminex API', version: 'v1', status: 'platform-foundation' }, request.id));

  app.post<{ Body: { email: string; password: string } }>('/api/v1/auth/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = readBody<{ email: string; password: string }>(request);
    const user = await repository.authenticate(email.toLowerCase().trim(), password);
    assert(user, 'INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
    const sessionId = `sess_${randomUUID()}`;
    const token = await app.jwt.sign({ sub: user.id, sid: sessionId });

    return reply.send(envelope({ token, user }, request.id));
  });

  app.post('/api/v1/auth/logout', { preHandler: authenticate }, async (request) => {
    const currentActor = actor(request);
    const sessionId = request.sessionId;
    assert(sessionId, 'UNAUTHENTICATED', 'Authentication required', 401);
    await repository.revokeSession(sessionId, currentActor, request.id);

    return envelope({ revoked: true }, request.id);
  });

  app.get('/api/v1/auth/me', { preHandler: authenticate }, async (request) => envelope({ user: actor(request), sessionId: request.sessionId }, request.id));
  app.get('/api/v1/setup/overview', { preHandler: authenticate }, async (request) => envelope(await repository.getSetupOverview(actor(request)), request.id));

  app.get<{ Params: { branchId: string } }>('/api/v1/branches/:branchId/setup', { preHandler: authenticate }, async (request) => envelope(await repository.getBranchSetup(actor(request), request.params.branchId), request.id));

  app.post<{ Body: { name: string; defaultCurrency?: string; defaultLocale?: string } }>('/api/v1/restaurants', { preHandler: authenticate, schema: restaurantSchema }, async (request, reply) => {
    const input = readBody<{ name: string; defaultCurrency?: string; defaultLocale?: string }>(request);
    assertPermission(actor(request), 'restaurant:write');

    return reply.code(201).send(envelope(await repository.createRestaurant(actor(request), { name: input.name, defaultCurrency: input.defaultCurrency, defaultLocale: input.defaultLocale }, request.id), request.id));
  });

  app.post<{ Params: { restaurantId: string }; Body: { name: string; code: string; timezone?: string; currency?: string; locale?: string; serviceHours?: Record<string, { open: string; close: string }> } }>('/api/v1/restaurants/:restaurantId/branches', { preHandler: authenticate, schema: branchSchema }, async (request, reply) => {
    const input = readBody<{ name: string; code: string; timezone?: string; currency?: string; locale?: string; serviceHours?: Record<string, { open: string; close: string }> }>(request);

    return reply.code(201).send(envelope(await repository.createBranch(actor(request), request.params.restaurantId, { name: input.name, code: input.code, timezone: input.timezone, currency: input.currency, locale: input.locale, serviceHours: input.serviceHours }, request.id), request.id));
  });

  app.patch<{ Params: { branchId: string }; Body: { name?: string; timezone?: string; currency?: string; locale?: string; serviceHours?: Record<string, { open: string; close: string }>; status?: 'ACTIVE' | 'INACTIVE' } }>('/api/v1/branches/:branchId', { preHandler: authenticate }, async (request) => {
    const input = readBody<{ name?: string; timezone?: string; currency?: string; locale?: string; serviceHours?: Record<string, { open: string; close: string }>; status?: 'ACTIVE' | 'INACTIVE' }>(request);

    return envelope(await repository.updateBranch(actor(request), request.params.branchId, input, request.id), request.id);
  });

  app.post<{ Params: { branchId: string }; Body: { name: string; sortOrder?: number } }>('/api/v1/branches/:branchId/areas', { preHandler: authenticate, schema: areaSchema }, async (request, reply) => {
    const input = readBody<{ name: string; sortOrder?: number }>(request);

    return reply.code(201).send(envelope(await repository.createArea(actor(request), request.params.branchId, { name: input.name, sortOrder: input.sortOrder }, request.id), request.id));
  });

  app.post<{ Params: { areaId: string }; Body: { label: string; capacity: number; accessibilityTags?: string[] } }>('/api/v1/areas/:areaId/tables', { preHandler: authenticate, schema: tableSchema }, async (request, reply) => {
    const input = readBody<{ label: string; capacity: number; accessibilityTags?: string[] }>(request);

    return reply.code(201).send(envelope(await repository.createTable(actor(request), request.params.areaId, { label: input.label, capacity: input.capacity, accessibilityTags: input.accessibilityTags }, request.id), request.id));
  });

  return app;
}
