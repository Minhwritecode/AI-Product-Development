import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import { assert } from '../platform/errors.js';
import { actor, envelope, readBody, readIdempotencyKey } from '../platform/http.js';
import type { PlatformRepository } from '../platform/types.js';
import type {
  ConfirmGoodsReceiptInput,
  CreateAssignmentInput,
  CreateCategoryInput,
  CreateDailyCountInput,
  CreateIngredientInput,
  CreateMenuItemInput,
  CreateMenuVersionInput,
  CreateModifierGroupInput,
  CreatePurchaseOrderInput,
  CreateRecipeInput,
  CreateShiftInput,
  CreateStaffInput,
  CreateStationAssignmentInput,
  CreateStockRequestInput,
  CreateSupplierInput,
  CreateTaskInput,
  CreateWastageInput,
  DashboardFilters,
  OperationsRepository,
  SetMenuItemAllergensInput,
  SetMenuItemAvailabilityInput,
  TaskCommandInput
} from './types.js';

const staffSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'displayName', 'email', 'roleCodes'],
    properties: {
      branchId: { type: 'string', minLength: 1 },
      displayName: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      roleCodes: { type: 'array', minItems: 1, items: { type: 'string' } },
      stationCodes: { type: 'array', items: { type: 'string' } },
      stationAssignments: {
        type: 'array',
        items: {
          type: 'object',
          required: ['roleCode', 'stationCode'],
          properties: {
            roleCode: { type: 'string' },
            stationCode: { type: 'string', minLength: 1 }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const shiftSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'label', 'startsAt', 'endsAt'],
    properties: {
      branchId: { type: 'string' },
      label: { type: 'string', minLength: 2 },
      startsAt: { type: 'string', format: 'date-time' },
      endsAt: { type: 'string', format: 'date-time' }
    },
    additionalProperties: false
  }
} as const;

const assignmentSchema = {
  body: {
    type: 'object',
    required: ['staffId', 'roleCode'],
    properties: {
      staffId: { type: 'string' },
      roleCode: { type: 'string' },
      stationCode: { type: 'string' }
    },
    additionalProperties: false
  }
} as const;

const stationAssignmentSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'roleCode', 'stationCode'],
    properties: {
      branchId: { type: 'string' },
      roleCode: { type: 'string' },
      stationCode: { type: 'string', minLength: 1 },
      effectiveFrom: { type: 'string', format: 'date-time' }
    },
    additionalProperties: false
  }
} as const;

const taskSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'title', 'sourceType'],
    properties: {
      branchId: { type: 'string' },
      title: { type: 'string', minLength: 2 },
      sourceType: { type: 'string', enum: ['SHIFT', 'QR_REQUEST', 'QUEUE', 'EXCEPTION', 'MANUAL'] },
      sourceId: { type: 'string' },
      priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
      requiredRole: { type: 'string' },
      stationCode: { type: 'string' },
      ownerId: { type: 'string' },
      dueAt: { type: 'string', format: 'date-time' }
    },
    additionalProperties: false
  }
} as const;

const taskCommandSchema = {
  body: {
    type: 'object',
    properties: {
      note: { type: 'string', maxLength: 500 },
      ownerId: { type: 'string' },
      stationCode: { type: 'string', minLength: 1 }
    },
    additionalProperties: false
  }
} as const;

const ingredientSchema = {
  body: {
    type: 'object',
    required: ['name', 'purchaseUnit', 'stockUnit', 'purchaseToStock', 'standardCost'],
    properties: {
      name: { type: 'string', minLength: 2 },
      purchaseUnit: { type: 'string', minLength: 1 },
      stockUnit: { type: 'string', minLength: 1 },
      purchaseToStock: { type: 'number', exclusiveMinimum: 0 },
      standardCost: { type: 'number', minimum: 0 }
    },
    additionalProperties: false
  }
} as const;

const supplierSchema = {
  body: {
    type: 'object',
    required: ['code', 'name'],
    properties: {
      code: { type: 'string', minLength: 2 },
      name: { type: 'string', minLength: 2 }
    },
    additionalProperties: false
  }
} as const;

const categorySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2 },
      sortOrder: { type: 'integer', minimum: 1 }
    },
    additionalProperties: false
  }
} as const;

const menuItemSchema = {
  body: {
    type: 'object',
    required: ['categoryId', 'name', 'price', 'stationCode'],
    properties: {
      categoryId: { type: 'string' },
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      allergenCodes: { type: 'array', items: { type: 'string' } },
      stationCode: { type: 'string', enum: ['KITCHEN', 'BAR'] }
    },
    additionalProperties: false
  }
} as const;

const recipeSchema = {
  body: {
    type: 'object',
    required: ['menuItemId', 'stationCode', 'lines'],
    properties: {
      menuItemId: { type: 'string' },
      stationCode: { type: 'string', enum: ['KITCHEN', 'BAR'] },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['ingredientId', 'quantity', 'unit'],
          properties: {
            ingredientId: { type: 'string' },
            quantity: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string', minLength: 1 }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const menuVersionSchema = {
  body: {
    type: 'object',
    required: ['menuItemId', 'price', 'effectiveFrom'],
    properties: {
      menuItemId: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      effectiveFrom: { type: 'string', format: 'date-time' }
    },
    additionalProperties: false
  }
} as const;

const modifierSchema = {
  body: {
    type: 'object',
    required: ['menuItemId', 'name', 'options'],
    properties: {
      menuItemId: { type: 'string' },
      name: { type: 'string', minLength: 2 },
      required: { type: 'boolean' },
      options: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['label'],
          properties: {
            label: { type: 'string', minLength: 1 },
            priceDelta: { type: 'number' }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const allergensSchema = {
  body: {
    type: 'object',
    required: ['allergenCodes'],
    properties: {
      allergenCodes: { type: 'array', uniqueItems: true, items: { type: 'string' } }
    },
    additionalProperties: false
  }
} as const;

const availabilitySchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['PUBLISHED', 'UNAVAILABLE', 'INACTIVE'] },
      reason: { type: 'string', maxLength: 500 }
    },
    additionalProperties: false
  }
} as const;

const purchaseOrderSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'supplierId', 'lines'],
    properties: {
      branchId: { type: 'string' },
      supplierId: { type: 'string' },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['ingredientId', 'orderedQuantity', 'unit'],
          properties: {
            ingredientId: { type: 'string' },
            orderedQuantity: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string' }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const goodsReceiptSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'purchaseOrderId', 'lines'],
    properties: {
      branchId: { type: 'string' },
      purchaseOrderId: { type: 'string' },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['ingredientId', 'acceptedQuantity', 'damagedQuantity', 'rejectedQuantity', 'unit'],
          properties: {
            ingredientId: { type: 'string' },
            acceptedQuantity: { type: 'number', minimum: 0 },
            damagedQuantity: { type: 'number', minimum: 0 },
            rejectedQuantity: { type: 'number', minimum: 0 },
            unit: { type: 'string' },
            note: { type: 'string', maxLength: 500 }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const stockRequestSchema = {
  body: {
    type: 'object',
    required: ['fromLocationId', 'toLocationId', 'reason', 'lines'],
    properties: {
      fromLocationId: { type: 'string' },
      toLocationId: { type: 'string' },
      reason: { type: 'string', minLength: 3, maxLength: 500 },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['ingredientId', 'requestedQuantity', 'unit'],
          properties: {
            ingredientId: { type: 'string' },
            requestedQuantity: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string' }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const dailyCountSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'businessDate', 'lines'],
    properties: {
      branchId: { type: 'string' },
      businessDate: { type: 'string', format: 'date' },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['ingredientId', 'openingQuantity', 'receivedQuantity', 'closingQuantity', 'unit'],
          properties: {
            ingredientId: { type: 'string' },
            openingQuantity: { type: 'number', minimum: 0 },
            receivedQuantity: { type: 'number', minimum: 0 },
            theoreticalSoldQuantity: { type: 'number', minimum: 0 },
            closingQuantity: { type: 'number', minimum: 0 },
            unit: { type: 'string' }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  }
} as const;

const wastageSchema = {
  body: {
    type: 'object',
    required: ['branchId', 'ingredientId', 'quantity', 'unit', 'reason'],
    properties: {
      branchId: { type: 'string' },
      ingredientId: { type: 'string' },
      quantity: { type: 'number', exclusiveMinimum: 0 },
      unit: { type: 'string' },
      reason: { type: 'string', minLength: 3, maxLength: 200 },
      note: { type: 'string', maxLength: 500 }
    },
    additionalProperties: false
  }
} as const;

export function registerOperationsRoutes(
  app: FastifyInstance,
  operationsRepository: OperationsRepository,
  platformRepository: PlatformRepository,
  authenticate: onRequestHookHandler
): void {
  // Staff & Shifts & Tasks
  app.get<{ Querystring: { branchId: string } }>('/api/v1/operations/workspace', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.getStaffWorkspace(actor(request), request.query.branchId), request.id);
  });

  app.post<{ Body: CreateStaffInput }>('/api/v1/staff', { preHandler: authenticate, schema: staffSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createStaff(actor(request), readBody<CreateStaffInput>(request), request.id), request.id));
  });

  app.post<{ Body: CreateShiftInput }>('/api/v1/shifts', { preHandler: authenticate, schema: shiftSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createShift(actor(request), readBody<CreateShiftInput>(request), request.id), request.id));
  });

  app.post<{ Params: { shiftId: string }; Body: CreateAssignmentInput }>('/api/v1/shifts/:shiftId/assignments', { preHandler: authenticate, schema: assignmentSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.assignShift(actor(request), request.params.shiftId, readBody<CreateAssignmentInput>(request), request.id), request.id));
  });

  app.post<{ Params: { staffId: string }; Body: CreateStationAssignmentInput }>('/api/v1/staff/:staffId/station-assignments', { preHandler: authenticate, schema: stationAssignmentSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createStationAssignment(actor(request), request.params.staffId, readBody<CreateStationAssignmentInput>(request), request.id), request.id));
  });

  app.post<{ Body: CreateTaskInput }>('/api/v1/operational-tasks', { preHandler: authenticate, schema: taskSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createTask(actor(request), readBody<CreateTaskInput>(request), request.id), request.id));
  });

  app.post<{ Params: { taskId: string; command: 'claim' | 'route' | 'resolve' | 'escalate' | 'handover' }; Body: TaskCommandInput }>('/api/v1/operational-tasks/:taskId/:command', { preHandler: authenticate, schema: taskCommandSchema }, async (request) => {
    assert(['claim', 'route', 'resolve', 'escalate', 'handover'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported task command');

    return envelope(await operationsRepository.commandTask(actor(request), request.params.taskId, request.params.command, readBody<TaskCommandInput>(request), request.id), request.id);
  });

  // Master Data
  app.get<{ Querystring: { branchId: string } }>('/api/v1/master-data/overview', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.getMasterData(actor(request), request.query.branchId), request.id);
  });

  app.post<{ Body: CreateIngredientInput }>('/api/v1/ingredients', { preHandler: authenticate, schema: ingredientSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createIngredient(actor(request), readBody<CreateIngredientInput>(request), request.id), request.id));
  });

  app.post<{ Body: CreateSupplierInput }>('/api/v1/suppliers', { preHandler: authenticate, schema: supplierSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createSupplier(actor(request), readBody<CreateSupplierInput>(request), request.id), request.id));
  });

  app.post<{ Body: CreateCategoryInput }>('/api/v1/menu/categories', { preHandler: authenticate, schema: categorySchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createCategory(actor(request), readBody<CreateCategoryInput>(request), request.id), request.id));
  });

  app.post<{ Body: CreateMenuItemInput }>('/api/v1/menu/items', { preHandler: authenticate, schema: menuItemSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createMenuItem(actor(request), readBody<CreateMenuItemInput>(request), request.id), request.id));
  });

  app.post<{ Params: { menuItemId: string } }>('/api/v1/menu/items/:menuItemId/publish', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.publishMenuItem(actor(request), request.params.menuItemId, request.id), request.id);
  });

  app.post<{ Body: CreateMenuVersionInput }>('/api/v1/menu/versions', { preHandler: authenticate, schema: menuVersionSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createMenuVersion(actor(request), readBody<CreateMenuVersionInput>(request), request.id), request.id));
  });

  app.post<{ Body: CreateModifierGroupInput }>('/api/v1/menu/modifier-groups', { preHandler: authenticate, schema: modifierSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createModifierGroup(actor(request), readBody<CreateModifierGroupInput>(request), request.id), request.id));
  });

  app.post<{ Params: { menuItemId: string }; Body: SetMenuItemAllergensInput }>('/api/v1/menu/items/:menuItemId/allergens', { preHandler: authenticate, schema: allergensSchema }, async (request) => {
    return envelope(await operationsRepository.setMenuItemAllergens(actor(request), request.params.menuItemId, readBody<SetMenuItemAllergensInput>(request), request.id), request.id);
  });

  app.post<{ Params: { menuItemId: string }; Body: SetMenuItemAvailabilityInput }>('/api/v1/menu/items/:menuItemId/availability', { preHandler: authenticate, schema: availabilitySchema }, async (request) => {
    return envelope(await operationsRepository.setMenuItemAvailability(actor(request), request.params.menuItemId, readBody<SetMenuItemAvailabilityInput>(request), request.id), request.id);
  });

  app.post<{ Body: CreateRecipeInput }>('/api/v1/recipes', { preHandler: authenticate, schema: recipeSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createRecipe(actor(request), readBody<CreateRecipeInput>(request), request.id), request.id));
  });

  app.post<{ Params: { recipeId: string } }>('/api/v1/recipes/:recipeId/publish', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.publishRecipe(actor(request), request.params.recipeId, request.id), request.id);
  });

  // BOH Workspace & Dashboard
  app.get<{ Querystring: { branchId: string } }>('/api/v1/boh/workspace', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.getBohWorkspace(actor(request), request.query.branchId), request.id);
  });

  app.get<{ Querystring: { branchId?: string; branchIds?: string; from?: string; to?: string; groupBy?: 'branch' | 'ingredient' } }>('/api/v1/dashboard/summary', { preHandler: authenticate }, async (request) => {
    const currentActor = actor(request);
    const setup = await platformRepository.getSetupOverview(currentActor);
    const branchIds = request.query.branchIds ? request.query.branchIds.split(',').map((branchId) => branchId.trim()).filter(Boolean) : request.query.branchId ? [request.query.branchId] : setup.branches.map((branch) => branch.id);
    const filters: DashboardFilters = { branchIds, from: request.query.from, to: request.query.to, groupBy: request.query.groupBy ?? 'ingredient' };
    const report = await operationsRepository.getDashboardReport(currentActor, filters);
    const audit = await platformRepository.getAuditLogs(currentActor, { branchId: branchIds.length === 1 ? branchIds[0] : undefined, limit: 40 });

    return envelope({ ...report, audit }, request.id);
  });

  app.get<{ Querystring: { branchId?: string; from?: string; to?: string; groupBy?: 'branch' | 'ingredient' } }>('/api/v1/dashboard/wastage-breakdown', { preHandler: authenticate }, async (request) => {
    const currentActor = actor(request);
    const setup = await platformRepository.getSetupOverview(currentActor);
    const branchIds = request.query.branchId ? [request.query.branchId] : setup.branches.map((branch) => branch.id);
    const report = await operationsRepository.getDashboardReport(currentActor, { branchIds, from: request.query.from, to: request.query.to, groupBy: request.query.groupBy ?? 'ingredient' });

    return envelope({ asOf: report.asOf, freshness: report.freshness, breakdown: report.wastageBreakdown }, request.id);
  });

  app.get<{ Querystring: { branchId?: string } }>('/api/v1/dashboard/low-stock', { preHandler: authenticate }, async (request) => {
    const currentActor = actor(request);
    const setup = await platformRepository.getSetupOverview(currentActor);
    const branchIds = request.query.branchId ? [request.query.branchId] : setup.branches.map((branch) => branch.id);
    const report = await operationsRepository.getDashboardReport(currentActor, { branchIds });

    return envelope({ asOf: report.asOf, freshness: report.freshness, items: report.lowStock }, request.id);
  });

  app.get<{ Querystring: { branchId?: string } }>('/api/v1/reconciliation/inventory', { preHandler: authenticate }, async (request) => {
    const currentActor = actor(request);
    const setup = await platformRepository.getSetupOverview(currentActor);
    const branchIds = request.query.branchId ? [request.query.branchId] : setup.branches.map((branch) => branch.id);
    const report = await operationsRepository.getDashboardReport(currentActor, { branchIds });

    return envelope({ asOf: report.asOf, freshness: report.freshness, items: report.discrepancies }, request.id);
  });

  // Purchasing, Receiving, Stock Requests, Count, Wastage
  app.post<{ Body: CreatePurchaseOrderInput }>('/api/v1/purchase-orders', { preHandler: authenticate, schema: purchaseOrderSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createPurchaseOrder(actor(request), readBody<CreatePurchaseOrderInput>(request), request.id, readIdempotencyKey(request)), request.id));
  });

  app.post<{ Params: { purchaseOrderId: string; command: 'send' | 'cancel' } }>('/api/v1/purchase-orders/:purchaseOrderId/:command', { preHandler: authenticate }, async (request) => {
    assert(['send', 'cancel'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported purchase order command');

    return envelope(await operationsRepository.commandPurchaseOrder(actor(request), request.params.purchaseOrderId, request.params.command, request.id, readIdempotencyKey(request)), request.id);
  });

  app.post<{ Body: ConfirmGoodsReceiptInput }>('/api/v1/goods-receipts/confirm', { preHandler: authenticate, schema: goodsReceiptSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.confirmGoodsReceipt(actor(request), readBody<ConfirmGoodsReceiptInput>(request), request.id, readIdempotencyKey(request)), request.id));
  });

  app.post<{ Body: CreateStockRequestInput }>('/api/v1/stock-requests', { preHandler: authenticate, schema: stockRequestSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createStockRequest(actor(request), readBody<CreateStockRequestInput>(request), request.id, readIdempotencyKey(request)), request.id));
  });

  app.post<{ Params: { requestId: string; command: 'approve' | 'reject' | 'ship' | 'accept' }; Body: { reason?: string } }>('/api/v1/stock-requests/:requestId/:command', { preHandler: authenticate }, async (request) => {
    assert(['approve', 'reject', 'ship', 'accept'].includes(request.params.command), 'VALIDATION_ERROR', 'Unsupported stock request command');
    const body = readBody<{ reason?: string }>(request);

    return envelope(await operationsRepository.commandStockRequest(actor(request), request.params.requestId, request.params.command, { reason: body.reason ?? '', idempotencyKey: readIdempotencyKey(request) }), request.id);
  });

  app.post<{ Body: CreateDailyCountInput }>('/api/v1/daily-counts', { preHandler: authenticate, schema: dailyCountSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createDailyCount(actor(request), readBody<CreateDailyCountInput>(request), request.id, readIdempotencyKey(request)), request.id));
  });

  app.post<{ Params: { countId: string } }>('/api/v1/daily-counts/:countId/submit', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.submitDailyCount(actor(request), request.params.countId, request.id, readIdempotencyKey(request)), request.id);
  });

  app.post<{ Body: CreateWastageInput }>('/api/v1/wastage', { preHandler: authenticate, schema: wastageSchema }, async (request, reply) => {
    return reply.code(201).send(envelope(await operationsRepository.createWastage(actor(request), readBody<CreateWastageInput>(request), request.id, readIdempotencyKey(request)), request.id));
  });

  app.post<{ Params: { wastageId: string } }>('/api/v1/wastage/:wastageId/submit', { preHandler: authenticate }, async (request) => {
    return envelope(await operationsRepository.submitWastage(actor(request), request.params.wastageId, request.id, readIdempotencyKey(request)), request.id);
  });
}
