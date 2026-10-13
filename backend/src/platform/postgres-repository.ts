import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { verifyPassword } from '../security/password.js';
import { AppError, assert, assertBranchScope, assertPermission } from './errors.js';
import type {
  Actor,
  Area,
  Branch,
  CreateAreaInput,
  CreateBranchInput,
  CreateRestaurantInput,
  CreateTableInput,
  PlatformRepository,
  Restaurant,
  RestaurantTable,
  SetupOverview,
  UpdateBranchInput
} from './types.js';

export function createPostgresRepository(pool: pg.Pool): PlatformRepository {
  type SqlExecutor = Pick<pg.Pool, 'query'>;

  async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function findActor(userId: string): Promise<Actor | null> {
    const user = await pool.query<{ id: string; email: string; display_name: string }>(
      "SELECT id, email, display_name FROM users WHERE id = $1 AND status = 'ACTIVE'",
      [userId]
    );

    if (!user.rowCount) return null;

    const [roles, permissions, memberships, restaurantMemberships] = await Promise.all([
      pool.query<{ code: Actor['roles'][number] }>('SELECT role_code AS code FROM user_roles WHERE user_id = $1', [userId]),
      pool.query<{ code: string }>('SELECT DISTINCT rp.permission_code AS code FROM user_roles ur JOIN role_permissions rp ON rp.role_code = ur.role_code WHERE ur.user_id = $1', [userId]),
      pool.query<{ branch_id: string; restaurant_id: string }>('SELECT bm.branch_id, b.restaurant_id FROM branch_memberships bm JOIN branches b ON b.id = bm.branch_id WHERE bm.user_id = $1', [userId]),
      pool.query<{ restaurant_id: string }>('SELECT restaurant_id FROM restaurant_memberships WHERE user_id = $1', [userId])
    ]);

    return {
      id: user.rows[0].id,
      email: user.rows[0].email,
      displayName: user.rows[0].display_name,
      roles: roles.rows.map((row) => row.code),
      permissions: permissions.rows.map((row) => row.code),
      branchIds: memberships.rows.map((row) => row.branch_id),
      restaurantIds: [...new Set([...memberships.rows.map((row) => row.restaurant_id), ...restaurantMemberships.rows.map((row) => row.restaurant_id)])]
    };
  }

  async function audit(executor: SqlExecutor, actor: Actor, requestId: string, action: string, entityType: string, entityId: string, branchId?: string): Promise<void> {
    await executor.query('INSERT INTO audit_logs (branch_id, actor_id, action, entity_type, entity_id, request_id) VALUES ($1, $2, $3, $4, $5, $6)', [branchId ?? null, actor.id, action, entityType, entityId, requestId]);
  }

  async function branchSetup(actor: Actor, branchId: string): Promise<SetupOverview['branches'][number]> {
    assertBranchScope(actor, branchId);

    const branchResult = await pool.query<{
      id: string;
      restaurant_id: string;
      name: string;
      code: string;
      timezone: string;
      currency: string;
      locale: string;
      service_hours: Branch['serviceHours'];
      status: Branch['status'];
    }>('SELECT id, restaurant_id, name, code, timezone, currency, locale, service_hours, status FROM branches WHERE id = $1', [branchId]);

    assert(branchResult.rowCount, 'NOT_FOUND', 'Branch not found', 404);

    const areas = await pool.query<{ id: string; branch_id: string; name: string; sort_order: number; status: Area['status'] }>('SELECT id, branch_id, name, sort_order, status FROM areas WHERE branch_id = $1 ORDER BY sort_order, name', [branchId]);
    const tables = await pool.query<{ id: string; area_id: string; label: string; capacity: number; accessibility_tags: string[]; status: RestaurantTable['status'] }>('SELECT id, area_id, label, capacity, accessibility_tags, status FROM restaurant_tables WHERE area_id IN (SELECT id FROM areas WHERE branch_id = $1) ORDER BY label', [branchId]);
    const branch = branchResult.rows[0];

    return {
      id: branch.id,
      restaurantId: branch.restaurant_id,
      name: branch.name,
      code: branch.code,
      timezone: branch.timezone,
      currency: branch.currency,
      locale: branch.locale,
      serviceHours: branch.service_hours,
      status: branch.status,
      areas: areas.rows.map((area) => ({
        id: area.id,
        branchId: area.branch_id,
        name: area.name,
        sortOrder: area.sort_order,
        status: area.status,
        tables: tables.rows.filter((table) => table.area_id === area.id).map((table) => ({
          id: table.id,
          areaId: table.area_id,
          label: table.label,
          capacity: table.capacity,
          accessibilityTags: table.accessibility_tags ?? [],
          status: table.status
        }))
      }))
    };
  }

  function mapRestaurant(row: { id: string; name: string; default_currency: string; default_locale: string; status: Restaurant['status'] }): Restaurant {
    return { id: row.id, name: row.name, defaultCurrency: row.default_currency, defaultLocale: row.default_locale, status: row.status };
  }

  function mapBranch(row: { id: string; restaurant_id: string; name: string; code: string; timezone: string; currency: string; locale: string; service_hours: Branch['serviceHours']; status: Branch['status'] }): Branch {
    return { id: row.id, restaurantId: row.restaurant_id, name: row.name, code: row.code, timezone: row.timezone, currency: row.currency, locale: row.locale, serviceHours: row.service_hours, status: row.status };
  }

  return {
    async authenticate(email, password) {
      const result = await pool.query<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = $1 AND status = 'ACTIVE'", [email]);

      if (!result.rowCount || !verifyPassword(password, result.rows[0].password_hash)) return null;

      return findActor(result.rows[0].id);
    },
    findActor,
    async isSessionRevoked(sessionId) {
      const result = await pool.query('SELECT 1 FROM session_revocations WHERE session_id = $1', [sessionId]);

      return Boolean(result.rowCount);
    },
    async revokeSession(sessionId, actor, requestId) {
      await pool.query('INSERT INTO session_revocations (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sessionId, actor.id]);
      await audit(pool, actor, requestId, 'SESSION_REVOKED', 'SESSION', sessionId);
    },
    async getSetupOverview(actor) {
      const restaurantResult = await pool.query<{ id: string; name: string; default_currency: string; default_locale: string; status: Restaurant['status'] }>('SELECT id, name, default_currency, default_locale, status FROM restaurants WHERE id = $1', [actor.restaurantIds[0]]);
      assert(restaurantResult.rowCount, 'NOT_FOUND', 'Restaurant not found', 404);
      const branches = await pool.query<{ id: string }>('SELECT id FROM branches WHERE restaurant_id = $1 AND ($2 = ANY($3::text[]) OR id = ANY($3::text[])) ORDER BY name', [actor.restaurantIds[0], '*', actor.branchIds]);

      return { restaurant: mapRestaurant(restaurantResult.rows[0]), branches: await Promise.all(branches.rows.map((row) => branchSetup(actor, row.id))) };
    },
    getBranchSetup: branchSetup,
    async createRestaurant(actor, input: CreateRestaurantInput, requestId) {
      assertPermission(actor, 'restaurant:write');
      assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Restaurant name must be at least 2 characters');
      const id = `rest_${randomUUID().slice(0, 8)}`;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const result = await client.query<{ id: string; name: string; default_currency: string; default_locale: string; status: Restaurant['status'] }>('INSERT INTO restaurants (id, name, default_currency, default_locale) VALUES ($1, $2, $3, $4) RETURNING id, name, default_currency, default_locale, status', [id, input.name.trim(), input.defaultCurrency ?? 'VND', input.defaultLocale ?? 'vi-VN']);
        await client.query('INSERT INTO restaurant_memberships (user_id, restaurant_id) VALUES ($1, $2)', [actor.id, id]);
        await audit(client, actor, requestId, 'RESTAURANT_CREATED', 'RESTAURANT', id);
        await client.query('COMMIT');

        return mapRestaurant(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async createBranch(actor, restaurantId, input: CreateBranchInput, requestId) {
      assertPermission(actor, 'branch:write');
      assert(actor.restaurantIds.includes('*') || actor.restaurantIds.includes(restaurantId), 'OUT_OF_SCOPE', 'Restaurant is outside the actor scope', 403);
      assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Branch name must be at least 2 characters');
      assert(/^[A-Z0-9_-]{2,24}$/.test(input.code), 'VALIDATION_ERROR', 'Branch code must use uppercase letters, numbers, _ or -');
      const id = `branch_${randomUUID().slice(0, 8)}`;

      try {
        return await withTransaction(async (client) => {
          const result = await client.query<{ id: string; restaurant_id: string; name: string; code: string; timezone: string; currency: string; locale: string; service_hours: Branch['serviceHours']; status: Branch['status'] }>('INSERT INTO branches (id, restaurant_id, name, code, timezone, currency, locale, service_hours) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, restaurant_id, name, code, timezone, currency, locale, service_hours, status', [id, restaurantId, input.name.trim(), input.code, input.timezone ?? 'Asia/Ho_Chi_Minh', input.currency ?? 'VND', input.locale ?? 'vi-VN', input.serviceHours ?? { daily: { open: '08:00', close: '23:00' } }]);
          await client.query('INSERT INTO branch_memberships (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [actor.id, id]);
          await audit(client, actor, requestId, 'BRANCH_CREATED', 'BRANCH', id, id);

          return mapBranch(result.rows[0]);
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('branches_code_key')) throw new AppError('CONFLICT', 'Branch code already exists', 409);
        throw error;
      }
    },
    async updateBranch(actor, branchId, input: UpdateBranchInput, requestId) {
      assertPermission(actor, 'branch:write');
      const current = await branchSetup(actor, branchId);

      return withTransaction(async (client) => {
        const result = await client.query<{ id: string; restaurant_id: string; name: string; code: string; timezone: string; currency: string; locale: string; service_hours: Branch['serviceHours']; status: Branch['status'] }>('UPDATE branches SET name = $2, timezone = $3, currency = $4, locale = $5, service_hours = $6, status = $7, updated_at = now() WHERE id = $1 RETURNING id, restaurant_id, name, code, timezone, currency, locale, service_hours, status', [branchId, input.name?.trim() ?? current.name, input.timezone ?? current.timezone, input.currency ?? current.currency, input.locale ?? current.locale, input.serviceHours ?? current.serviceHours, input.status ?? current.status]);
        await audit(client, actor, requestId, 'BRANCH_UPDATED', 'BRANCH', branchId, branchId);

        return mapBranch(result.rows[0]);
      });
    },
    async createArea(actor, branchId, input: CreateAreaInput, requestId) {
      assertPermission(actor, 'area:write');
      assertBranchScope(actor, branchId);
      assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Area name must be at least 2 characters');
      const id = `area_${randomUUID().slice(0, 8)}`;

      try {
        return await withTransaction(async (client) => {
          const result = await client.query<{ id: string; branch_id: string; name: string; sort_order: number; status: Area['status'] }>('INSERT INTO areas (id, branch_id, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id, branch_id, name, sort_order, status', [id, branchId, input.name.trim(), input.sortOrder ?? 1]);
          await audit(client, actor, requestId, 'AREA_CREATED', 'AREA', id, branchId);
          const row = result.rows[0];

          return { id: row.id, branchId: row.branch_id, name: row.name, sortOrder: row.sort_order, status: row.status };
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('areas_branch_id_name_key')) throw new AppError('CONFLICT', 'Area name already exists in this branch', 409);
        throw error;
      }
    },
    async createTable(actor, areaId, input: CreateTableInput, requestId) {
      assertPermission(actor, 'table:write');
      const areaResult = await pool.query<{ branch_id: string }>('SELECT branch_id FROM areas WHERE id = $1', [areaId]);
      assert(areaResult.rowCount, 'NOT_FOUND', 'Area not found', 404);
      assertBranchScope(actor, areaResult.rows[0].branch_id);
      assert(input.label.trim().length >= 1, 'VALIDATION_ERROR', 'Table label is required');
      assert(Number.isInteger(input.capacity) && input.capacity > 0 && input.capacity <= 30, 'VALIDATION_ERROR', 'Table capacity must be an integer between 1 and 30');
      const id = `table_${randomUUID().slice(0, 8)}`;

      try {
        return await withTransaction(async (client) => {
          const result = await client.query<{ id: string; area_id: string; label: string; capacity: number; accessibility_tags: string[]; status: RestaurantTable['status'] }>('INSERT INTO restaurant_tables (id, area_id, label, capacity, accessibility_tags) VALUES ($1, $2, $3, $4, $5) RETURNING id, area_id, label, capacity, accessibility_tags, status', [id, areaId, input.label.trim(), input.capacity, JSON.stringify(input.accessibilityTags ?? [])]);
          await audit(client, actor, requestId, 'TABLE_CREATED', 'TABLE', id, areaResult.rows[0].branch_id);
          const row = result.rows[0];

          return { id: row.id, areaId: row.area_id, label: row.label, capacity: row.capacity, accessibilityTags: row.accessibility_tags ?? [], status: row.status };
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('restaurant_tables_area_id_label_key')) throw new AppError('CONFLICT', 'Table label already exists in this area', 409);
        throw error;
      }
    }
  };
}
