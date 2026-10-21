import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { AppError, assert, assertPermission } from './platform/errors.js';
import { createMemoryRepository } from './platform/memory-repository.js';
import type { Actor, PlatformRepository } from './platform/types.js';
import { createMemoryOperationsRepository } from './operations/memory-repository.js';
import type { CreateAssignmentInput, CreateCategoryInput, CreateIngredientInput, CreateMenuItemInput, CreateMenuVersionInput, CreateModifierGroupInput, CreateRecipeInput, CreateShiftInput, CreateStaffInput, CreateStationAssignmentInput, CreateSupplierInput, CreateTaskInput, OperationsRepository, SetMenuItemAllergensInput, SetMenuItemAvailabilityInput, TaskCommandInput } from './operations/types.js';

type JwtPayload = { sub: string; sid: string };

type AppOptions = {
  repository?: PlatformRepository;
  operationsRepository?: OperationsRepository;
  jwtSecret?: string;
  databaseStatus?: () => Promise<'ok' | 'unavailable' | 'not-configured'>;
};

const loginSchema = { body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } }, additionalProperties: false } } as const;

const restaurantSchema = { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2 }, defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 }, defaultLocale: { type: 'string' } }, additionalProperties: false } } as const;

const branchSchema = { body: { type: 'object', required: ['name', 'code'], properties: { name: { type: 'string', minLength: 2 }, code: { type: 'string', pattern: '^[A-Z0-9_-]{2,24}$' }, timezone: { type: 'string' }, currency: { type: 'string', minLength: 3, maxLength: 3 }, locale: { type: 'string' }, serviceHours: { type: 'object' } }, additionalProperties: false } } as const;

const areaSchema = { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2 }, sortOrder: { type: 'integer', minimum: 1 } }, additionalProperties: false } } as const;

const tableSchema = { body: { type: 'object', required: ['label', 'capacity'], properties: { label: { type: 'string', minLength: 1 }, capacity: { type: 'integer', minimum: 1, maximum: 30 }, accessibilityTags: { type: 'array', items: { type: 'string' } } }, additionalProperties: false } } as const;

const staffSchema = { body: { type: 'object', required: ['branchId', 'displayName', 'email', 'roleCodes'], properties: { branchId: { type: 'string', minLength: 1 }, displayName: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' }, roleCodes: { type: 'array', minItems: 1, items: { type: 'string' } }, stationCodes: { type: 'array', items: { type: 'string' } }, stationAssignments: { type: 'array', items: { type: 'object', required: ['roleCode', 'stationCode'], properties: { roleCode: { type: 'string' }, stationCode: { type: 'string', minLength: 1 } }, additionalProperties: false } } }, additionalProperties: false } } as const;

const shiftSchema = { body: { type: 'object', required: ['branchId', 'label', 'startsAt', 'endsAt'], properties: { branchId: { type: 'string' }, label: { type: 'string', minLength: 2 }, startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time' } }, additionalProperties: false } } as const;

const assignmentSchema = { body: { type: 'object', required: ['staffId', 'roleCode'], properties: { staffId: { type: 'string' }, roleCode: { type: 'string' }, stationCode: { type: 'string' } }, additionalProperties: false } } as const;

const taskSchema = { body: { type: 'object', required: ['branchId', 'title', 'sourceType'], properties: { branchId: { type: 'string' }, title: { type: 'string', minLength: 2 }, sourceType: { type: 'string', enum: ['SHIFT', 'QR_REQUEST', 'QUEUE', 'EXCEPTION', 'MANUAL'] }, sourceId: { type: 'string' }, priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] }, requiredRole: { type: 'string' }, stationCode: { type: 'string' }, ownerId: { type: 'string' }, dueAt: { type: 'string', format: 'date-time' } }, additionalProperties: false } } as const;

const taskCommandSchema = { body: { type: 'object', properties: { note: { type: 'string', maxLength: 500 }, ownerId: { type: 'string' }, stationCode: { type: 'string', minLength: 1 } }, additionalProperties: false } } as const;

const ingredientSchema = { body: { type: 'object', required: ['name', 'purchaseUnit', 'stockUnit', 'purchaseToStock', 'standardCost'], properties: { name: { type: 'string', minLength: 2 }, purchaseUnit: { type: 'string', minLength: 1 }, stockUnit: { type: 'string', minLength: 1 }, purchaseToStock: { type: 'number', exclusiveMinimum: 0 }, standardCost: { type: 'number', minimum: 0 } }, additionalProperties: false } } as const;

const supplierSchema = { body: { type: 'object', required: ['code', 'name'], properties: { code: { type: 'string', minLength: 2 }, name: { type: 'string', minLength: 2 } }, additionalProperties: false } } as const;

const categorySchema = { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2 }, sortOrder: { type: 'integer', minimum: 1 } }, additionalProperties: false } } as const;

const menuItemSchema = { body: { type: 'object', required: ['categoryId', 'name', 'price', 'stationCode'], properties: { categoryId: { type: 'string' }, name: { type: 'string', minLength: 2 }, description: { type: 'string' }, price: { type: 'number', minimum: 0 }, currency: { type: 'string', minLength: 3, maxLength: 3 }, allergenCodes: { type: 'array', items: { type: 'string' } }, stationCode: { type: 'string', enum: ['KITCHEN', 'BAR'] } }, additionalProperties: false } } as const;

const recipeSchema = { body: { type: 'object', required: ['menuItemId', 'stationCode', 'lines'], properties: { menuItemId: { type: 'string' }, stationCode: { type: 'string', enum: ['KITCHEN', 'BAR'] }, lines: { type: 'array', minItems: 1, items: { type: 'object', required: ['ingredientId', 'quantity', 'unit'], properties: { ingredientId: { type: 'string' }, quantity: { type: 'number', exclusiveMinimum: 0 }, unit: { type: 'string', minLength: 1 } }, additionalProperties: false } } }, additionalProperties: false } } as const;

const stationAssignmentSchema = { body: { type: 'object', required: ['branchId', 'roleCode', 'stationCode'], properties: { branchId: { type: 'string' }, roleCode: { type: 'string' }, stationCode: { type: 'string', minLength: 1 }, effectiveFrom: { type: 'string', format: 'date-time' } }, additionalProperties: false } } as const;

const menuVersionSchema = { body: { type: 'object', required: ['menuItemId', 'price', 'effectiveFrom'], properties: { menuItemId: { type: 'string' }, price: { type: 'number', minimum: 0 }, effectiveFrom: { type: 'string', format: 'date-time' } }, additionalProperties: false } } as const;

const modifierSchema = { body: { type: 'object', required: ['menuItemId', 'name', 'options'], properties: { menuItemId: { type: 'string' }, name: { type: 'string', minLength: 2 }, required: { type: 'boolean' }, options: { type: 'array', minItems: 1, items: { type: 'object', required: ['label'], properties: { label: { type: 'string', minLength: 1 }, priceDelta: { type: 'number' } }, additionalProperties: false } } }, additionalProperties: false } } as const;

const allergensSchema = { body: { type: 'object', required: ['allergenCodes'], properties: { allergenCodes: { type: 'array', uniqueItems: true, items: { type: 'string' } } }, additionalProperties: false } } as const;

const availabilitySchema = { body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['PUBLISHED', 'UNAVAILABLE', 'INACTIVE'] }, reason: { type: 'string', maxLength: 500 } }, additionalProperties: false } } as const;

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
  const operationsRepository = options.operationsRepository ?? createMemoryOperationsRepository();
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
    const ready = postgres === 'ok';

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

  app.get<{ Querystring: { branchId: string } }>('/api/v1/operations/workspace', { preHandler: authenticate }, async (request) => envelope(await operationsRepository.getStaffWorkspace(actor(request), request.query.branchId), request.id));
  app.post<{ Body: CreateStaffInput }>('/api/v1/staff', { preHandler: authenticate, schema: staffSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createStaff(actor(request), readBody<CreateStaffInput>(request), request.id), request.id)));
  app.post<{ Body: CreateShiftInput }>('/api/v1/shifts', { preHandler: authenticate, schema: shiftSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createShift(actor(request), readBody<CreateShiftInput>(request), request.id), request.id)));
  app.post<{ Params: { shiftId: string }; Body: CreateAssignmentInput }>('/api/v1/shifts/:shiftId/assignments', { preHandler: authenticate, schema: assignmentSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.assignShift(actor(request), request.params.shiftId, readBody<CreateAssignmentInput>(request), request.id), request.id)));
  app.post<{ Params: { staffId: string }; Body: CreateStationAssignmentInput }>('/api/v1/staff/:staffId/station-assignments', { preHandler: authenticate, schema: stationAssignmentSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createStationAssignment(actor(request), request.params.staffId, readBody<CreateStationAssignmentInput>(request), request.id), request.id)));
  app.post<{ Body: CreateTaskInput }>('/api/v1/operational-tasks', { preHandler: authenticate, schema: taskSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createTask(actor(request), readBody<CreateTaskInput>(request), request.id), request.id)));
  app.post<{ Params: { taskId: string; command: 'claim' | 'route' | 'resolve' | 'escalate' | 'handover' }; Body: TaskCommandInput }>('/api/v1/operational-tasks/:taskId/:command', { preHandler: authenticate, schema: taskCommandSchema }, async (request) => { assert(['claim', 'route', 'resolve', 'escalate', 'handover'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported task command');

 return envelope(await operationsRepository.commandTask(actor(request), request.params.taskId, request.params.command, readBody<TaskCommandInput>(request), request.id), request.id); });
  app.get<{ Querystring: { branchId: string } }>('/api/v1/master-data/overview', { preHandler: authenticate }, async (request) => envelope(await operationsRepository.getMasterData(actor(request), request.query.branchId), request.id));
  app.post<{ Body: CreateIngredientInput }>('/api/v1/ingredients', { preHandler: authenticate, schema: ingredientSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createIngredient(actor(request), readBody<CreateIngredientInput>(request), request.id), request.id)));
  app.post<{ Body: CreateSupplierInput }>('/api/v1/suppliers', { preHandler: authenticate, schema: supplierSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createSupplier(actor(request), readBody<CreateSupplierInput>(request), request.id), request.id)));
  app.post<{ Body: CreateCategoryInput }>('/api/v1/menu/categories', { preHandler: authenticate, schema: categorySchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createCategory(actor(request), readBody<CreateCategoryInput>(request), request.id), request.id)));
  app.post<{ Body: CreateMenuItemInput }>('/api/v1/menu/items', { preHandler: authenticate, schema: menuItemSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createMenuItem(actor(request), readBody<CreateMenuItemInput>(request), request.id), request.id)));
  app.post<{ Params: { menuItemId: string } }>('/api/v1/menu/items/:menuItemId/publish', { preHandler: authenticate }, async (request) => envelope(await operationsRepository.publishMenuItem(actor(request), request.params.menuItemId, request.id), request.id));
  app.post<{ Body: CreateMenuVersionInput }>('/api/v1/menu/versions', { preHandler: authenticate, schema: menuVersionSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createMenuVersion(actor(request), readBody<CreateMenuVersionInput>(request), request.id), request.id)));
  app.post<{ Body: CreateModifierGroupInput }>('/api/v1/menu/modifier-groups', { preHandler: authenticate, schema: modifierSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createModifierGroup(actor(request), readBody<CreateModifierGroupInput>(request), request.id), request.id)));
  app.post<{ Params: { menuItemId: string }; Body: SetMenuItemAllergensInput }>('/api/v1/menu/items/:menuItemId/allergens', { preHandler: authenticate, schema: allergensSchema }, async (request) => envelope(await operationsRepository.setMenuItemAllergens(actor(request), request.params.menuItemId, readBody<SetMenuItemAllergensInput>(request), request.id), request.id));
  app.post<{ Params: { menuItemId: string }; Body: SetMenuItemAvailabilityInput }>('/api/v1/menu/items/:menuItemId/availability', { preHandler: authenticate, schema: availabilitySchema }, async (request) => envelope(await operationsRepository.setMenuItemAvailability(actor(request), request.params.menuItemId, readBody<SetMenuItemAvailabilityInput>(request), request.id), request.id));
  app.post<{ Body: CreateRecipeInput }>('/api/v1/recipes', { preHandler: authenticate, schema: recipeSchema }, async (request, reply) => reply.code(201).send(envelope(await operationsRepository.createRecipe(actor(request), readBody<CreateRecipeInput>(request), request.id), request.id)));
  app.post<{ Params: { recipeId: string } }>('/api/v1/recipes/:recipeId/publish', { preHandler: authenticate }, async (request) => envelope(await operationsRepository.publishRecipe(actor(request), request.params.recipeId, request.id), request.id));

  return app;
}
