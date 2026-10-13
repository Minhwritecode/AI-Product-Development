import { randomUUID } from 'node:crypto';
import { assert, assertBranchScope, assertPermission } from './errors.js';
import type {
  Actor,
  Area,
  Branch,
  PlatformRepository,
  Restaurant,
  RestaurantTable
} from './types.js';
import { hashPassword, verifyPassword } from '../security/password.js';

type MemoryState = {
  passwordByEmail: Map<string, string>;
  actors: Map<string, Actor>;
  restaurants: Map<string, Restaurant>;
  branches: Map<string, Branch>;
  areas: Map<string, Area>;
  tables: Map<string, RestaurantTable>;
  revokedSessions: Set<string>;
  auditEvents: Array<{ id: string; action: string; entityType: string; entityId: string; actorId: string; requestId: string }>;
};

const demoPassword = hashPassword('luminex-demo', 'luminex-demo-salt');

export function createMemoryRepository(): PlatformRepository {
  const state: MemoryState = {
    passwordByEmail: new Map([['admin@luminex.local', demoPassword]]),
    actors: new Map([
      [
        'usr_owner',
        {
          id: 'usr_owner',
          email: 'admin@luminex.local',
          displayName: 'Linh Nguyễn',
          roles: ['OWNER'],
          permissions: ['*'],
          branchIds: ['*'],
          restaurantIds: ['rest_luminex']
        }
      ]
    ]),
    restaurants: new Map([
      [
        'rest_luminex',
        {
          id: 'rest_luminex',
          name: 'Luminex Demo Restaurant',
          defaultCurrency: 'VND',
          defaultLocale: 'vi-VN',
          status: 'ACTIVE'
        }
      ]
    ]),
    branches: new Map([
      [
        'branch_central',
        {
          id: 'branch_central',
          restaurantId: 'rest_luminex',
          name: 'Phố đi bộ Central',
          code: 'CENTRAL',
          timezone: 'Asia/Ho_Chi_Minh',
          currency: 'VND',
          locale: 'vi-VN',
          serviceHours: { daily: { open: '08:00', close: '23:00' } },
          status: 'ACTIVE'
        }
      ]
    ]),
    areas: new Map([
      ['area_main', { id: 'area_main', branchId: 'branch_central', name: 'Main floor', sortOrder: 1, status: 'ACTIVE' }],
      ['area_rooftop', { id: 'area_rooftop', branchId: 'branch_central', name: 'Rooftop', sortOrder: 2, status: 'ACTIVE' }]
    ]),
    tables: new Map([
      ['table_01', { id: 'table_01', areaId: 'area_main', label: 'T01', capacity: 2, accessibilityTags: [], status: 'READY' }],
      ['table_02', { id: 'table_02', areaId: 'area_main', label: 'T02', capacity: 4, accessibilityTags: ['window'], status: 'READY' }],
      ['table_03', { id: 'table_03', areaId: 'area_main', label: 'T03', capacity: 6, accessibilityTags: ['family'], status: 'READY' }],
      ['table_04', { id: 'table_04', areaId: 'area_rooftop', label: 'R01', capacity: 4, accessibilityTags: ['outdoor'], status: 'BLOCKED' }]
    ]),
    revokedSessions: new Set(),
    auditEvents: []
  };

  const getBranch = (branchId: string) => {
    const branch = state.branches.get(branchId);
    assert(branch, 'NOT_FOUND', 'Branch not found', 404);

    return branch;
  };

  const getArea = (areaId: string) => {
    const area = state.areas.get(areaId);
    assert(area, 'NOT_FOUND', 'Area not found', 404);

    return area;
  };

  const repository: PlatformRepository = {
    async authenticate(email, password) {
      const actor = [...state.actors.values()].find((candidate) => candidate.email === email);
      const encoded = state.passwordByEmail.get(email);

      return actor && encoded && verifyPassword(password, encoded) ? actor : null;
    },
    async findActor(userId) {
      return state.actors.get(userId) ?? null;
    },
    async isSessionRevoked(sessionId) {
      return state.revokedSessions.has(sessionId);
    },
    async revokeSession(sessionId, actor, requestId) {
      state.revokedSessions.add(sessionId);
      recordAudit('SESSION_REVOKED', 'SESSION', sessionId, actor.id, requestId);
    },
    async getSetupOverview(actor) {
      const restaurantId = actor.restaurantIds[0];
      const restaurant = state.restaurants.get(restaurantId);
      assert(restaurant, 'NOT_FOUND', 'Restaurant not found', 404);

      const branches = [...state.branches.values()].flatMap((branch) => branch.restaurantId === restaurant.id && (actor.branchIds.includes('*') || actor.branchIds.includes(branch.id)) ? [{ ...branch, areas: buildAreas(branch.id) }] : []);

      return { restaurant, branches };
    },
    async getBranchSetup(actor, branchId) {
      assertBranchScope(actor, branchId);
      const branch = getBranch(branchId);

      return { ...branch, areas: buildAreas(branch.id) };
    },
    async createRestaurant(actor, input, requestId) {
      assertPermission(actor, 'restaurant:write');
      assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Restaurant name must be at least 2 characters');

      const restaurant: Restaurant = {
        id: `rest_${randomUUID().slice(0, 8)}`,
        name: input.name.trim(),
        defaultCurrency: input.defaultCurrency ?? 'VND',
        defaultLocale: input.defaultLocale ?? 'vi-VN',
        status: 'ACTIVE'
      };

      state.restaurants.set(restaurant.id, restaurant);
      actor.restaurantIds.push(restaurant.id);
      recordAudit('RESTAURANT_CREATED', 'RESTAURANT', restaurant.id, actor.id, requestId);

      return restaurant;
    },
    async createBranch(actor, restaurantId, input, requestId) {
      assertPermission(actor, 'branch:write');
      assert(actor.restaurantIds.includes('*') || actor.restaurantIds.includes(restaurantId), 'OUT_OF_SCOPE', 'Restaurant is outside the actor scope', 403);
      assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Branch name must be at least 2 characters');
      assert(/^[A-Z0-9_-]{2,24}$/.test(input.code), 'VALIDATION_ERROR', 'Branch code must use uppercase letters, numbers, _ or -');
      assert(![...state.branches.values()].some((branch) => branch.code === input.code), 'CONFLICT', 'Branch code already exists', 409);

      const branch: Branch = {
        id: `branch_${randomUUID().slice(0, 8)}`,
        restaurantId,
        name: input.name.trim(),
        code: input.code,
        timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
        currency: input.currency ?? 'VND',
        locale: input.locale ?? 'vi-VN',
        serviceHours: input.serviceHours ?? { daily: { open: '08:00', close: '23:00' } },
        status: 'ACTIVE'
      };

      state.branches.set(branch.id, branch);
      actor.branchIds.push(branch.id);
      recordAudit('BRANCH_CREATED', 'BRANCH', branch.id, actor.id, requestId);

      return branch;
    },
    async updateBranch(actor, branchId, input, requestId) {
      assertPermission(actor, 'branch:write');
      assertBranchScope(actor, branchId);
      const branch = getBranch(branchId);
      const updated = { ...branch, ...input, name: input.name?.trim() ?? branch.name };
      state.branches.set(branchId, updated);
      recordAudit('BRANCH_UPDATED', 'BRANCH', branchId, actor.id, requestId);

      return updated;
    },
    async createArea(actor, branchId, input, requestId) {
      assertPermission(actor, 'area:write');
      assertBranchScope(actor, branchId);
      assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Area name must be at least 2 characters');
      const area: Area = { id: `area_${randomUUID().slice(0, 8)}`, branchId, name: input.name.trim(), sortOrder: input.sortOrder ?? 1, status: 'ACTIVE' };
      state.areas.set(area.id, area);
      recordAudit('AREA_CREATED', 'AREA', area.id, actor.id, requestId);

      return area;
    },
    async createTable(actor, areaId, input, requestId) {
      assertPermission(actor, 'table:write');
      const area = getArea(areaId);
      assertBranchScope(actor, area.branchId);
      assert(input.label.trim().length >= 1, 'VALIDATION_ERROR', 'Table label is required');
      assert(Number.isInteger(input.capacity) && input.capacity > 0 && input.capacity <= 30, 'VALIDATION_ERROR', 'Table capacity must be an integer between 1 and 30');
      assert(![...state.tables.values()].some((table) => table.areaId === areaId && table.label === input.label.trim()), 'CONFLICT', 'Table label already exists in this area', 409);
      const table: RestaurantTable = { id: `table_${randomUUID().slice(0, 8)}`, areaId, label: input.label.trim(), capacity: input.capacity, accessibilityTags: input.accessibilityTags ?? [], status: 'READY' };
      state.tables.set(table.id, table);
      recordAudit('TABLE_CREATED', 'TABLE', table.id, actor.id, requestId);

      return table;
    }
  };

  function buildAreas(branchId: string): Array<Area & { tables: RestaurantTable[] }> {
    return [...state.areas.values()]
      .filter((area) => area.branchId === branchId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((area) => ({ ...area, tables: [...state.tables.values()].filter((table) => table.areaId === area.id) }));
  }

  function recordAudit(action: string, entityType: string, entityId: string, actorId: string, requestId: string) {
    state.auditEvents.push({ id: randomUUID(), action, entityType, entityId, actorId, requestId });
  }

  return repository;
}
