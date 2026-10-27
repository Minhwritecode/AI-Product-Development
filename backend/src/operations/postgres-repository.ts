import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Actor, RoleCode } from '../platform/types.js';
import type {
  CreateAssignmentInput, CreateCategoryInput, CreateIngredientInput, CreateMenuItemInput, CreateMenuVersionInput, CreateModifierGroupInput, CreateRecipeInput, CreateStationAssignmentInput,
  CreateShiftInput, CreateStaffInput, CreateSupplierInput, CreateTaskInput, Ingredient, MasterDataOverview,
  MenuCategory, MenuItem, MenuVersion, ModifierGroup, OperationalTask, OperationsRepository, RecipeLine,
  RecipeVersion, Shift, ShiftAssignment, StaffProfile, StaffWorkspace, Supplier, SetMenuItemAllergensInput, SetMenuItemAvailabilityInput, StationAssignment, UnitDefinition, Allergen, BohWorkspace, CreateDailyCountInput, CreatePurchaseOrderInput, CreateStockRequestInput, CreateWastageInput, DailyCount, GoodsReceipt, PurchaseOrder, StockRequest, WastageRecord, StockBalance, StockLedgerEntry, ConfirmGoodsReceiptInput
} from './types.js';

type Executor = Pick<pg.Pool, 'query'>;

type NumericRow = string | number;

type NotificationPayload = { label?: string; staffId?: string; priority?: string; status?: string; escalationLevel?: number };

export function createPostgresOperationsRepository(pool: pg.Pool): OperationsRepository {
  async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
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

  async function audit(executor: Executor, actor: Actor, requestId: string, action: string, type: string, id: string, branchId?: string) {
    await executor.query('INSERT INTO audit_logs (branch_id, actor_id, action, entity_type, entity_id, request_id) VALUES ($1, $2, $3, $4, $5, $6)', [branchId ?? null, actor.id, action, type, id, requestId]);
  }

  async function notification(executor: Executor, branchId: string, eventType: string, entityType: string, entityId: string, payload: NotificationPayload = {}) {
    await executor.query('INSERT INTO notification_events (id, branch_id, event_type, entity_type, entity_id, payload) VALUES ($1, $2, $3, $4, $5, $6)', [`notification_${randomUUID().slice(0, 8)}`, branchId, eventType, entityType, entityId, JSON.stringify(payload)]);
  }

  function restaurantId(actor: Actor): string {
    const id = actor.restaurantIds.find((value) => value !== '*');
    assert(id, 'OUT_OF_SCOPE', 'Restaurant scope is required', 403);

    return id;
  }

  function write(actor: Actor) { assertPermission(actor, 'master-data:write'); }

  function operationsWrite(actor: Actor, permission: string) { assertPermission(actor, permission); }

  async function replay<T>(executor: Executor, actor: Actor, key: string, command: string): Promise<T | undefined> {
    const result = await executor.query<{ response: T }>('SELECT response FROM idempotency_records WHERE idempotency_key = $1 AND actor_id = $2 AND command = $3', [key, actor.id, command]);

    return result.rowCount ? result.rows[0].response : undefined;
  }

  async function remember<T>(executor: Executor, actor: Actor, key: string, command: string, response: T) {
    await executor.query('INSERT INTO idempotency_records (idempotency_key, actor_id, command, response) VALUES ($1, $2, $3, $4)', [key, actor.id, command, JSON.stringify(response)]);
  }

  function mapStaff(row: { id: string; branch_id: string; display_name: string; email: string; status: StaffProfile['status']; station_codes: string[]; role_codes: RoleCode[] }): StaffProfile {
    return { id: row.id, branchId: row.branch_id, displayName: row.display_name, email: row.email, status: row.status, stationCodes: row.station_codes ?? [], roleCodes: row.role_codes ?? [] };
  }

  function mapTask(row: { id: string; branch_id: string; title: string; source_type: OperationalTask['sourceType']; source_id?: string; priority: OperationalTask['priority']; required_role?: RoleCode; station_code?: string; owner_id?: string; due_at?: string; status: OperationalTask['status']; resolution_note?: string; escalation_level: number; created_at: string; updated_at: string }): OperationalTask {
    return { id: row.id, branchId: row.branch_id, title: row.title, sourceType: row.source_type, sourceId: row.source_id ?? undefined, priority: row.priority, requiredRole: row.required_role ?? undefined, stationCode: row.station_code ?? undefined, ownerId: row.owner_id ?? undefined, dueAt: row.due_at ?? undefined, status: row.status, resolutionNote: row.resolution_note ?? undefined, escalationLevel: row.escalation_level, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  function mapIngredient(row: { id: string; name: string; purchase_unit: string; stock_unit: string; purchase_to_stock: NumericRow; standard_cost: NumericRow; status: Ingredient['status'] }): Ingredient {
    return { id: row.id, name: row.name, purchaseUnit: row.purchase_unit, stockUnit: row.stock_unit, purchaseToStock: Number(row.purchase_to_stock), standardCost: Number(row.standard_cost), status: row.status };
  }

  function mapMenuItem(row: { id: string; category_id: string; name: string; description: string; price: NumericRow; currency: string; status: MenuItem['status']; allergen_codes: string[]; station_code: MenuItem['stationCode']; published_version_id?: string }): MenuItem {
    return { id: row.id, categoryId: row.category_id, name: row.name, description: row.description, price: Number(row.price), currency: row.currency, status: row.status, allergenCodes: row.allergen_codes ?? [], stationCode: row.station_code, publishedVersionId: row.published_version_id ?? undefined };
  }

  async function getStaffById(executor: Executor, id: string) {
    const result = await executor.query<{ id: string; branch_id: string; display_name: string; email: string; status: StaffProfile['status']; station_codes: string[]; role_codes: RoleCode[] }>(`SELECT s.id, s.branch_id, s.display_name, s.email, s.status, s.station_codes, COALESCE(array_agg(sr.role_code) FILTER (WHERE sr.role_code IS NOT NULL), ARRAY[]::text[]) AS role_codes FROM staff_profiles s LEFT JOIN staff_roles sr ON sr.staff_id = s.id WHERE s.id = $1 GROUP BY s.id`, [id]);
    assert(result.rowCount, 'NOT_FOUND', 'Staff profile not found', 404);

    return mapStaff(result.rows[0]);
  }

  async function getShift(executor: Executor, id: string) {
    const result = await executor.query<{ id: string; branch_id: string; label: string; starts_at: string; ends_at: string; status: Shift['status'] }>('SELECT id, branch_id, label, starts_at, ends_at, status FROM shifts WHERE id = $1', [id]);
    assert(result.rowCount, 'NOT_FOUND', 'Shift not found', 404);

    return result.rows[0];
  }

  async function getTask(executor: Executor, id: string) {
    const result = await executor.query<Parameters<typeof mapTask>[0]>('SELECT id, branch_id, title, source_type, source_id, priority, required_role, station_code, owner_id, due_at, status, resolution_note, escalation_level, created_at, updated_at FROM operational_tasks WHERE id = $1', [id]);
    assert(result.rowCount, 'NOT_FOUND', 'Operational task not found', 404);

    return result.rows[0];
  }

  return {
    async getStaffWorkspace(actor, branchId): Promise<StaffWorkspace> {
      assertBranchScope(actor, branchId);

      const [staffResult, stationResult, shiftResult, assignmentResult, taskResult] = await Promise.all([
        pool.query<{ id: string; branch_id: string; display_name: string; email: string; status: StaffProfile['status']; station_codes: string[]; role_codes: RoleCode[] }>(`SELECT s.id, s.branch_id, s.display_name, s.email, s.status, s.station_codes, COALESCE(array_agg(sr.role_code) FILTER (WHERE sr.role_code IS NOT NULL), ARRAY[]::text[]) AS role_codes FROM staff_profiles s LEFT JOIN staff_roles sr ON sr.staff_id = s.id WHERE s.branch_id = $1 GROUP BY s.id ORDER BY s.display_name`, [branchId]),
        pool.query<{ id: string; branch_id: string; staff_id: string; role_code: RoleCode; station_code: string; status: StationAssignment['status']; effective_from: string; effective_to?: string }>('SELECT id, branch_id, staff_id, role_code, station_code, status, effective_from, effective_to FROM station_assignments WHERE branch_id = $1 ORDER BY effective_from DESC', [branchId]),
        pool.query<{ id: string; branch_id: string; label: string; starts_at: string; ends_at: string; status: Shift['status'] }>('SELECT id, branch_id, label, starts_at, ends_at, status FROM shifts WHERE branch_id = $1 ORDER BY starts_at DESC', [branchId]),
        pool.query<{ id: string; shift_id: string; staff_id: string; role_code: RoleCode; station_code?: string; status: ShiftAssignment['status'] }>('SELECT id, shift_id, staff_id, role_code, station_code, status FROM shift_assignments WHERE shift_id IN (SELECT id FROM shifts WHERE branch_id = $1)', [branchId]),
        pool.query<Parameters<typeof mapTask>[0]>('SELECT id, branch_id, title, source_type, source_id, priority, required_role, station_code, owner_id, due_at, status, resolution_note, escalation_level, created_at, updated_at FROM operational_tasks WHERE branch_id = $1 ORDER BY CASE priority WHEN \'URGENT\' THEN 1 WHEN \'HIGH\' THEN 2 WHEN \'NORMAL\' THEN 3 ELSE 4 END, due_at NULLS LAST', [branchId])
      ]);

      const assignmentsByShift = new Map<string, ShiftAssignment[]>();
      assignmentResult.rows.forEach((row) => { const list = assignmentsByShift.get(row.shift_id) ?? []; list.push({ id: row.id, shiftId: row.shift_id, staffId: row.staff_id, roleCode: row.role_code, stationCode: row.station_code ?? undefined, status: row.status }); assignmentsByShift.set(row.shift_id, list); });

      return { staff: staffResult.rows.map(mapStaff), stationAssignments: stationResult.rows.map((row): StationAssignment => ({ id: row.id, branchId: row.branch_id, staffId: row.staff_id, roleCode: row.role_code, stationCode: row.station_code, status: row.status, effectiveFrom: row.effective_from, effectiveTo: row.effective_to ?? undefined })), shifts: shiftResult.rows.map((row) => ({ id: row.id, branchId: row.branch_id, label: row.label, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, assignments: assignmentsByShift.get(row.id) ?? [] })), tasks: taskResult.rows.map(mapTask) };
    },
    async createStaff(actor, input: CreateStaffInput, requestId) {
      operationsWrite(actor, 'staff:write'); assertBranchScope(actor, input.branchId); assert(input.displayName.trim().length >= 2, 'VALIDATION_ERROR', 'Staff display name is required'); assert(input.roleCodes.length > 0, 'VALIDATION_ERROR', 'At least one role is required');

      return transaction(async (client) => {
        const id = `staff_${randomUUID().slice(0, 8)}`;
        const result = await client.query<{ id: string; branch_id: string; display_name: string; email: string; status: StaffProfile['status']; station_codes: string[]; role_codes: RoleCode[] }>('INSERT INTO staff_profiles (id, branch_id, display_name, email, station_codes) VALUES ($1, $2, $3, $4, $5) RETURNING id, branch_id, display_name, email, status, station_codes, ARRAY[]::text[] AS role_codes', [id, input.branchId, input.displayName.trim(), input.email.trim().toLowerCase(), JSON.stringify(input.stationCodes ?? [])]);

        for (const role of input.roleCodes) await client.query('INSERT INTO staff_roles (staff_id, role_code) VALUES ($1, $2)', [id, role]);

        for (const assignment of input.stationAssignments ?? (input.stationCodes ?? []).map((stationCode) => ({ roleCode: input.roleCodes[0], stationCode }))) {
          assert(input.roleCodes.includes(assignment.roleCode), 'VALIDATION_ERROR', 'Station role must belong to staff');
          await client.query('INSERT INTO station_assignments (id, branch_id, staff_id, role_code, station_code) VALUES ($1, $2, $3, $4, $5)', [`station_assign_${randomUUID().slice(0, 8)}`, input.branchId, id, assignment.roleCode, assignment.stationCode.trim()]);
        }

        await audit(client, actor, requestId, 'STAFF_CREATED', 'STAFF', id, input.branchId);

        return mapStaff({ ...result.rows[0], role_codes: input.roleCodes });
      });
    },
    async createShift(actor, input: CreateShiftInput, requestId) {
      operationsWrite(actor, 'shift:write'); assertBranchScope(actor, input.branchId); assert(new Date(input.startsAt).getTime() < new Date(input.endsAt).getTime(), 'VALIDATION_ERROR', 'Shift must end after it starts');

      return transaction(async (client) => {
        const overlap = await client.query('SELECT 1 FROM shifts WHERE branch_id = $1 AND status <> \'CANCELLED\' AND starts_at < $3 AND ends_at > $2 LIMIT 1', [input.branchId, input.startsAt, input.endsAt]);
        assert(!overlap.rowCount, 'CONFLICT', 'Shift overlaps an existing shift', 409);
        const id = `shift_${randomUUID().slice(0, 8)}`;
        const result = await client.query<{ id: string; branch_id: string; label: string; starts_at: string; ends_at: string; status: Shift['status'] }>('INSERT INTO shifts (id, branch_id, label, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, branch_id, label, starts_at, ends_at, status', [id, input.branchId, input.label.trim(), input.startsAt, input.endsAt]);
        await audit(client, actor, requestId, 'SHIFT_CREATED', 'SHIFT', id, input.branchId);
        await notification(client, input.branchId, 'SHIFT_CREATED', 'SHIFT', id, { label: input.label.trim() });
        const row = result.rows[0];

 return { id: row.id, branchId: row.branch_id, label: row.label, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, assignments: [] };
      });
    },
    async assignShift(actor, shiftId, input: CreateAssignmentInput, requestId) {
      operationsWrite(actor, 'shift:write');

      return transaction(async (client) => {
        const shift = await getShift(client, shiftId); assertBranchScope(actor, shift.branch_id); const staff = await getStaffById(client, input.staffId); assert(staff.branchId === shift.branch_id, 'OUT_OF_SCOPE', 'Staff belongs to another branch', 403); assert(staff.roleCodes.includes(input.roleCode), 'VALIDATION_ERROR', 'Staff does not hold the selected role');

 if (input.stationCode) assert(staff.stationCodes.includes(input.stationCode), 'VALIDATION_ERROR', 'Staff is not assigned to this station');
        const id = `assignment_${randomUUID().slice(0, 8)}`; const result = await client.query<{ id: string; shift_id: string; staff_id: string; role_code: RoleCode; station_code?: string; status: ShiftAssignment['status'] }>('INSERT INTO shift_assignments (id, shift_id, staff_id, role_code, station_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, shift_id, staff_id, role_code, station_code, status', [id, shiftId, input.staffId, input.roleCode, input.stationCode ?? null]); await audit(client, actor, requestId, 'SHIFT_ASSIGNED', 'SHIFT_ASSIGNMENT', id, shift.branch_id); await notification(client, shift.branch_id, 'SHIFT_ASSIGNED', 'SHIFT_ASSIGNMENT', id, { staffId: input.staffId }); const row = result.rows[0];

 return { id: row.id, shiftId: row.shift_id, staffId: row.staff_id, roleCode: row.role_code, stationCode: row.station_code ?? undefined, status: row.status };
      });
    },
    async createStationAssignment(actor, staffId, input: CreateStationAssignmentInput, requestId) {
      operationsWrite(actor, 'shift:write'); assertBranchScope(actor, input.branchId);

      return transaction(async (client) => {
        const staff = await getStaffById(client, staffId);
        assert(staff.branchId === input.branchId, 'OUT_OF_SCOPE', 'Staff belongs to another branch', 403);
        assert(staff.status === 'ACTIVE', 'CONFLICT', 'Inactive staff cannot be assigned', 409);
        assert(staff.roleCodes.includes(input.roleCode), 'VALIDATION_ERROR', 'Staff does not hold the selected role');
        assert(input.stationCode.trim().length > 0, 'VALIDATION_ERROR', 'Station is required');
        const duplicate = await client.query('SELECT 1 FROM station_assignments WHERE staff_id = $1 AND station_code = $2 AND status = \'ACTIVE\' AND effective_to IS NULL', [staffId, input.stationCode.trim()]);
        assert(!duplicate.rowCount, 'CONFLICT', 'Staff already has this active station assignment', 409);
        const id = `station_assign_${randomUUID().slice(0, 8)}`;
        const result = await client.query<{ id: string; branch_id: string; staff_id: string; role_code: RoleCode; station_code: string; status: StationAssignment['status']; effective_from: string; effective_to?: string }>('INSERT INTO station_assignments (id, branch_id, staff_id, role_code, station_code, effective_from) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, branch_id, staff_id, role_code, station_code, status, effective_from, effective_to', [id, input.branchId, staffId, input.roleCode, input.stationCode.trim(), input.effectiveFrom ?? new Date().toISOString()]);
        await client.query('UPDATE staff_profiles SET station_codes = (SELECT to_jsonb(ARRAY(SELECT DISTINCT value FROM jsonb_array_elements_text(station_codes || $2::jsonb) AS value))) WHERE id = $1', [staffId, JSON.stringify([input.stationCode.trim()])]);
        await audit(client, actor, requestId, 'STATION_ASSIGNED', 'STATION_ASSIGNMENT', id, input.branchId);
        await notification(client, input.branchId, 'STATION_ASSIGNED', 'STATION_ASSIGNMENT', id, { staffId, status: 'ACTIVE' });
        const row = result.rows[0];

        return { id: row.id, branchId: row.branch_id, staffId: row.staff_id, roleCode: row.role_code, stationCode: row.station_code, status: row.status, effectiveFrom: row.effective_from, effectiveTo: row.effective_to ?? undefined };
      });
    },
    async createTask(actor, input: CreateTaskInput, requestId) {
      operationsWrite(actor, 'task:write'); assertBranchScope(actor, input.branchId);

 if (input.ownerId) { const owner = await getStaffById(pool, input.ownerId); assert(owner.branchId === input.branchId, 'OUT_OF_SCOPE', 'Task owner belongs to another branch', 403); }

      return transaction(async (client) => { const id = `task_${randomUUID().slice(0, 8)}`; const result = await client.query<Parameters<typeof mapTask>[0]>('INSERT INTO operational_tasks (id, branch_id, title, source_type, source_id, priority, required_role, station_code, owner_id, due_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, branch_id, title, source_type, source_id, priority, required_role, station_code, owner_id, due_at, status, resolution_note, escalation_level, created_at, updated_at', [id, input.branchId, input.title.trim(), input.sourceType, input.sourceId ?? null, input.priority ?? 'NORMAL', input.requiredRole ?? null, input.stationCode ?? null, input.ownerId ?? null, input.dueAt ?? null, input.ownerId ? 'CLAIMED' : 'OPEN']); await audit(client, actor, requestId, 'TASK_CREATED', 'OPERATIONAL_TASK', id, input.branchId);

 await notification(client, input.branchId, 'TASK_CREATED', 'OPERATIONAL_TASK', id, { priority: input.priority ?? 'NORMAL' });

 return mapTask(result.rows[0]); });
    },
    async commandTask(actor, taskId, command, input, requestId) {
      operationsWrite(actor, 'task:write');

      return transaction(async (client) => {
        const row = await getTask(client, taskId); assertBranchScope(actor, row.branch_id);

 if (command === 'claim') { assert(row.status === 'OPEN' || row.status === 'ESCALATED', 'CONFLICT', 'Only open or escalated tasks can be claimed', 409); row.owner_id = actor.id; row.status = 'CLAIMED'; }

 if (command === 'route') { assert(row.status !== 'RESOLVED' && row.status !== 'CANCELLED', 'CONFLICT', 'Resolved task cannot be routed', 409); row.status = 'IN_PROGRESS'; }

 if (command === 'resolve') { assert(row.status !== 'RESOLVED' && row.status !== 'CANCELLED', 'CONFLICT', 'Task is already closed', 409); const note = input.note?.trim(); assert(note, 'VALIDATION_ERROR', 'Resolution note is required'); row.status = 'RESOLVED'; row.resolution_note = note; }

 if (command === 'handover') {
   assert(row.status !== 'RESOLVED' && row.status !== 'CANCELLED', 'CONFLICT', 'Closed task cannot be handed over', 409);
   const note = input.note?.trim(); assert(note, 'VALIDATION_ERROR', 'Handover reason is required'); assert(input.ownerId, 'VALIDATION_ERROR', 'Handover owner is required');
   const owner = await getStaffById(client, input.ownerId); assert(owner.branchId === row.branch_id && owner.status === 'ACTIVE', 'CONFLICT', 'Handover owner is not active in this branch', 409);

   if (row.required_role) assert(owner.roleCodes.includes(row.required_role), 'VALIDATION_ERROR', 'Handover owner does not hold the required role');

   if (input.stationCode) { const station = await client.query('SELECT 1 FROM station_assignments WHERE staff_id = $1 AND station_code = $2 AND status = \'ACTIVE\' AND effective_to IS NULL', [owner.id, input.stationCode]); assert(station.rowCount, 'VALIDATION_ERROR', 'Handover owner is not assigned to this station'); }

   row.owner_id = owner.id; row.station_code = input.stationCode ?? row.station_code; row.status = 'IN_PROGRESS'; row.resolution_note = note;
 }

 if (command === 'escalate') { assert(row.status !== 'RESOLVED' && row.status !== 'CANCELLED', 'CONFLICT', 'Closed task cannot be escalated', 409); row.status = 'ESCALATED'; row.escalation_level += 1; }

 await client.query('UPDATE operational_tasks SET owner_id = $2, station_code = $3, status = $4, resolution_note = $5, escalation_level = $6, updated_at = now() WHERE id = $1', [taskId, row.owner_id ?? null, row.station_code ?? null, row.status, row.resolution_note ?? null, row.escalation_level]); await audit(client, actor, requestId, `TASK_${command.toUpperCase()}`, 'OPERATIONAL_TASK', taskId, row.branch_id); await notification(client, row.branch_id, `TASK_${command.toUpperCase()}`, 'OPERATIONAL_TASK', taskId, { status: row.status, staffId: row.owner_id, escalationLevel: row.escalation_level }); const updated = await getTask(client, taskId);

 return mapTask(updated);
      });
    },
    async getMasterData(actor, branchId): Promise<MasterDataOverview> {
      assertBranchScope(actor, branchId); const rid = restaurantId(actor);

 const [ingredients, suppliers, categories, items, versions, modifiers, options, recipes, lines, units, allergens] = await Promise.all([
        pool.query('SELECT id, name, purchase_unit, stock_unit, purchase_to_stock, standard_cost, status FROM ingredients WHERE restaurant_id = $1 ORDER BY name', [rid]), pool.query('SELECT id, code, name, status FROM suppliers WHERE restaurant_id = $1 ORDER BY name', [rid]), pool.query('SELECT id, name, sort_order, status FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order, name', [rid]), pool.query('SELECT id, category_id, name, description, price, currency, status, allergen_codes, station_code, published_version_id FROM menu_items WHERE restaurant_id = $1 ORDER BY name', [rid]), pool.query('SELECT id, menu_item_id, version, price, effective_from, status FROM menu_versions WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = $1) ORDER BY version DESC', [rid]), pool.query('SELECT id, menu_item_id, name, required FROM modifier_groups WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = $1)', [rid]), pool.query('SELECT id, modifier_group_id, label, price_delta FROM modifier_options WHERE modifier_group_id IN (SELECT id FROM modifier_groups WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = $1))', [rid]), pool.query('SELECT id, menu_item_id, version, status, station_code, published_at FROM recipe_versions WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = $1) ORDER BY version DESC', [rid]), pool.query('SELECT rl.recipe_version_id, rl.ingredient_id, rl.quantity, rl.unit, rl.canonical_quantity FROM recipe_lines rl JOIN recipe_versions rv ON rv.id = rl.recipe_version_id JOIN menu_items mi ON mi.id = rv.menu_item_id WHERE mi.restaurant_id = $1', [rid]), pool.query('SELECT code, dimension, to_base, status FROM unit_catalog WHERE status = \'ACTIVE\' ORDER BY code'), pool.query('SELECT code, label, status FROM allergens WHERE status = \'ACTIVE\' ORDER BY code')
      ]);

      // SAFETY: These read-only rows select the exact columns declared in the projection immediately above.
      // SAFETY: The options query selects the exact fields used by this projection.
      const optionRows = options.rows as { id: string; modifier_group_id: string; label: string; price_delta: NumericRow }[];
      // SAFETY: The modifier group query selects the exact fields used by this projection.
      const groupRows = modifiers.rows as { id: string; menu_item_id: string; name: string; required: boolean }[];
      const groups: ModifierGroup[] = groupRows.map((group) => ({ id: group.id, menuItemId: group.menu_item_id, name: group.name, required: group.required, options: optionRows.filter((option) => option.modifier_group_id === group.id).map((option) => ({ id: option.id, label: option.label, priceDelta: Number(option.price_delta) })) }));
      // SAFETY: The recipe line query selects the exact fields used by this projection.
      const lineRows = lines.rows as { recipe_version_id: string; ingredient_id: string; quantity: NumericRow; unit: string; canonical_quantity?: NumericRow }[];
      // SAFETY: The recipe version query selects the exact fields used by this projection.
      const recipeRows = recipes.rows as { id: string; menu_item_id: string; version: number; status: RecipeVersion['status']; station_code: RecipeVersion['stationCode']; published_at?: string }[];

      // SAFETY: The repository maps the selected database projection into the public API DTO without accepting client-provided fields.
      return { ingredients: ingredients.rows.map((row) => mapIngredient(row as Parameters<typeof mapIngredient>[0])), suppliers: suppliers.rows as Supplier[], categories: categories.rows.map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order, status: row.status })), menuItems: items.rows.map((row) => mapMenuItem(row as Parameters<typeof mapMenuItem>[0])), menuVersions: versions.rows.map((row) => ({ id: row.id, menuItemId: row.menu_item_id, version: row.version, price: Number(row.price), effectiveFrom: row.effective_from, status: row.status } as MenuVersion)), modifierGroups: groups, recipes: recipeRows.map((row) => ({ id: row.id, menuItemId: row.menu_item_id, version: row.version, status: row.status, stationCode: row.station_code, publishedAt: row.published_at ?? undefined, lines: lineRows.filter((line) => line.recipe_version_id === row.id).map((line): RecipeLine => ({ ingredientId: line.ingredient_id, quantity: Number(line.quantity), unit: line.unit, canonicalQuantity: line.canonical_quantity === null || line.canonical_quantity === undefined ? undefined : Number(line.canonical_quantity) })) })), units: units.rows.map((row): UnitDefinition => ({ code: row.code, dimension: row.dimension, toBase: Number(row.to_base), status: row.status })), allergens: allergens.rows.map((row): Allergen => ({ code: row.code, label: row.label, status: row.status })) };
    },
    async createIngredient(actor, input: CreateIngredientInput, requestId) { write(actor); const rid = restaurantId(actor); assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Ingredient name is required'); assert(input.purchaseToStock > 0, 'VALIDATION_ERROR', 'Unit conversion must be greater than zero'); assert(input.standardCost >= 0, 'VALIDATION_ERROR', 'Standard cost cannot be negative');

 return transaction(async (client) => { const unitResult = await client.query<{ code: string; dimension: string }>('SELECT code, dimension FROM unit_catalog WHERE code = ANY($1::text[]) AND status = \'ACTIVE\'', [[input.purchaseUnit, input.stockUnit]]); assert(unitResult.rowCount === 2 && unitResult.rows[0].dimension === unitResult.rows[1].dimension, 'VALIDATION_ERROR', 'Purchase and stock units must be known and share a dimension'); const id = `ingredient_${randomUUID().slice(0, 8)}`; const result = await client.query('INSERT INTO ingredients (id, restaurant_id, name, purchase_unit, stock_unit, purchase_to_stock, standard_cost) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, purchase_unit, stock_unit, purchase_to_stock, standard_cost, status', [id, rid, input.name.trim(), input.purchaseUnit, input.stockUnit, input.purchaseToStock, input.standardCost]); await audit(client, actor, requestId, 'INGREDIENT_CREATED', 'INGREDIENT', id);

 return mapIngredient(result.rows[0]); }); },
    async createSupplier(actor, input: CreateSupplierInput, requestId) { write(actor); const rid = restaurantId(actor); const code = input.code.trim().toUpperCase(); assert(code.length >= 2 && input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Supplier code and name are required');

 return transaction(async (client) => { const id = `supplier_${randomUUID().slice(0, 8)}`; const result = await client.query('INSERT INTO suppliers (id, restaurant_id, code, name) VALUES ($1, $2, $3, $4) RETURNING id, code, name, status', [id, rid, code, input.name.trim()]); await audit(client, actor, requestId, 'SUPPLIER_CREATED', 'SUPPLIER', id);

 // SAFETY: INSERT ... RETURNING selects the complete Supplier DTO fields.
 return result.rows[0] as Supplier; }); },
    async createCategory(actor, input: CreateCategoryInput, requestId) { write(actor); const rid = restaurantId(actor); assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Category name is required');

 return transaction(async (client) => { const id = `category_${randomUUID().slice(0, 8)}`; const result = await client.query('INSERT INTO menu_categories (id, restaurant_id, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id, name, sort_order, status', [id, rid, input.name.trim(), input.sortOrder ?? 1]); await audit(client, actor, requestId, 'MENU_CATEGORY_CREATED', 'MENU_CATEGORY', id);

 // SAFETY: INSERT ... RETURNING selects the complete MenuCategory DTO fields.
 return { id: result.rows[0].id, name: result.rows[0].name, sortOrder: result.rows[0].sort_order, status: result.rows[0].status } as MenuCategory; }); },
    async createMenuItem(actor, input: CreateMenuItemInput, requestId) { write(actor); const rid = restaurantId(actor); assert(input.name.trim().length >= 2 && input.price >= 0, 'VALIDATION_ERROR', 'Menu name and non-negative price are required');

 return transaction(async (client) => { const category = await client.query('SELECT id FROM menu_categories WHERE id = $1 AND restaurant_id = $2 AND status = \'ACTIVE\'', [input.categoryId, rid]); assert(category.rowCount, 'NOT_FOUND', 'Menu category not found', 404); const allergenCodes = input.allergenCodes ?? []; const knownAllergens = await client.query('SELECT code FROM allergens WHERE code = ANY($1::text[]) AND status = \'ACTIVE\'', [allergenCodes]); assert(knownAllergens.rowCount === allergenCodes.length, 'VALIDATION_ERROR', 'Menu item contains an unknown allergen'); const id = `item_${randomUUID().slice(0, 8)}`; const result = await client.query('INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, currency, allergen_codes, station_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, category_id, name, description, price, currency, status, allergen_codes, station_code, published_version_id', [id, rid, input.categoryId, input.name.trim(), input.description?.trim() ?? '', input.price, input.currency ?? 'VND', JSON.stringify(allergenCodes), input.stationCode]); await client.query('INSERT INTO menu_item_allergens (menu_item_id, allergen_code) SELECT $1, code FROM allergens WHERE code = ANY($2::text[])', [id, allergenCodes]); await audit(client, actor, requestId, 'MENU_ITEM_CREATED', 'MENU_ITEM', id);

 return mapMenuItem(result.rows[0]); }); },
    async publishMenuItem(actor, menuItemId, requestId) { write(actor); const rid = restaurantId(actor);

 return transaction(async (client) => { const itemResult = await client.query('SELECT id, category_id, name, description, price, currency, status, allergen_codes, station_code, published_version_id FROM menu_items WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [menuItemId, rid]); assert(itemResult.rowCount, 'NOT_FOUND', 'Menu item not found', 404); const draft = await client.query<{ id: string; price: NumericRow }>('SELECT id, price FROM menu_versions WHERE menu_item_id = $1 AND status = \'DRAFT\' ORDER BY version DESC LIMIT 1 FOR UPDATE', [menuItemId]); const latest = await client.query<{ version: number }>('SELECT COALESCE(MAX(version), 0)::int AS version FROM menu_versions WHERE menu_item_id = $1', [menuItemId]); const versionId = draft.rowCount ? draft.rows[0].id : `menu_version_${randomUUID().slice(0, 8)}`;

 if (draft.rowCount) await client.query('UPDATE menu_versions SET status = \'PUBLISHED\' WHERE id = $1', [versionId]); else await client.query('INSERT INTO menu_versions (id, menu_item_id, version, price, effective_from, status) VALUES ($1, $2, $3, $4, now(), \'PUBLISHED\')', [versionId, menuItemId, latest.rows[0].version + 1, itemResult.rows[0].price]); const versionPrice = draft.rowCount ? draft.rows[0].price : itemResult.rows[0].price; await client.query('UPDATE menu_versions SET status = \'RETIRED\' WHERE menu_item_id = $1 AND id <> $2 AND status = \'PUBLISHED\'', [menuItemId, versionId]); const result = await client.query('UPDATE menu_items SET price = $3, status = \'PUBLISHED\', published_version_id = $2, updated_at = now() WHERE id = $1 RETURNING id, category_id, name, description, price, currency, status, allergen_codes, station_code, published_version_id', [menuItemId, versionId, versionPrice]); await audit(client, actor, requestId, 'MENU_ITEM_PUBLISHED', 'MENU_ITEM', menuItemId);

 return mapMenuItem(result.rows[0]); }); },
    async createMenuVersion(actor, input: CreateMenuVersionInput, requestId) { write(actor); const rid = restaurantId(actor); assert(input.price >= 0, 'VALIDATION_ERROR', 'Menu price cannot be negative'); assert(Number.isFinite(new Date(input.effectiveFrom).getTime()), 'VALIDATION_ERROR', 'Effective time is invalid');

 return transaction(async (client) => { const item = await client.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [input.menuItemId, rid]); assert(item.rowCount, 'NOT_FOUND', 'Menu item not found', 404); const latest = await client.query<{ version: number }>('SELECT COALESCE(MAX(version), 0)::int AS version FROM menu_versions WHERE menu_item_id = $1', [input.menuItemId]); const id = `menu_version_${randomUUID().slice(0, 8)}`; const result = await client.query('INSERT INTO menu_versions (id, menu_item_id, version, price, effective_from, status) VALUES ($1, $2, $3, $4, $5, \'DRAFT\') RETURNING id, menu_item_id, version, price, effective_from, status', [id, input.menuItemId, latest.rows[0].version + 1, input.price, input.effectiveFrom]); await audit(client, actor, requestId, 'MENU_VERSION_CREATED', 'MENU_VERSION', id); const row = result.rows[0];

 // SAFETY: The INSERT ... RETURNING projection is the complete MenuVersion DTO shape.
 return { id: row.id, menuItemId: row.menu_item_id, version: row.version, price: Number(row.price), effectiveFrom: row.effective_from, status: row.status } as MenuVersion; }); },
    async createModifierGroup(actor, input: CreateModifierGroupInput, requestId) { write(actor); assert(input.name.trim().length >= 2 && input.options.length > 0, 'VALIDATION_ERROR', 'Modifier group needs a name and at least one option'); const labels = input.options.map((option) => option.label.trim().toLowerCase()); assert(new Set(labels).size === labels.length && input.options.every((option) => option.label.trim().length > 0), 'VALIDATION_ERROR', 'Modifier options must be unique and non-empty'); const rid = restaurantId(actor);

 return transaction(async (client) => { const item = await client.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [input.menuItemId, rid]); assert(item.rowCount, 'NOT_FOUND', 'Menu item not found', 404); const id = `modifier_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO modifier_groups (id, menu_item_id, name, required) VALUES ($1, $2, $3, $4)', [id, input.menuItemId, input.name.trim(), input.required ?? false]); const options = [];

 for (const option of input.options) { const optionId = `modifier_option_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO modifier_options (id, modifier_group_id, label, price_delta) VALUES ($1, $2, $3, $4)', [optionId, id, option.label.trim(), option.priceDelta ?? 0]); options.push({ id: optionId, label: option.label.trim(), priceDelta: option.priceDelta ?? 0 }); }

 await audit(client, actor, requestId, 'MODIFIER_GROUP_CREATED', 'MODIFIER_GROUP', id);

 // SAFETY: This transaction inserts the group and every option before returning the complete ModifierGroup DTO.
 return { id, menuItemId: input.menuItemId, name: input.name.trim(), required: input.required ?? false, options } as ModifierGroup; }); },
    async setMenuItemAllergens(actor, menuItemId, input: SetMenuItemAllergensInput, requestId) { write(actor); const rid = restaurantId(actor); assert(new Set(input.allergenCodes).size === input.allergenCodes.length, 'VALIDATION_ERROR', 'Duplicate allergens are not allowed');

 return transaction(async (client) => { const item = await client.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [menuItemId, rid]); assert(item.rowCount, 'NOT_FOUND', 'Menu item not found', 404); const known = await client.query('SELECT code FROM allergens WHERE code = ANY($1::text[]) AND status = \'ACTIVE\'', [input.allergenCodes]); assert(known.rowCount === input.allergenCodes.length, 'VALIDATION_ERROR', 'Menu item contains an unknown allergen'); await client.query('DELETE FROM menu_item_allergens WHERE menu_item_id = $1', [menuItemId]); await client.query('INSERT INTO menu_item_allergens (menu_item_id, allergen_code) SELECT $1, code FROM allergens WHERE code = ANY($2::text[])', [menuItemId, input.allergenCodes]); const result = await client.query('UPDATE menu_items SET allergen_codes = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id, category_id, name, description, price, currency, status, allergen_codes, station_code, published_version_id', [menuItemId, JSON.stringify(input.allergenCodes)]); await audit(client, actor, requestId, 'MENU_ITEM_ALLERGENS_SET', 'MENU_ITEM', menuItemId);

 return mapMenuItem(result.rows[0]); }); },
    async setMenuItemAvailability(actor, menuItemId, input: SetMenuItemAvailabilityInput, requestId) { write(actor); const rid = restaurantId(actor);

 if (input.status === 'INACTIVE') assert(input.reason?.trim(), 'VALIDATION_ERROR', 'Deactivation reason is required');

 return transaction(async (client) => { const item = await client.query<{ id: string; published_version_id?: string }>('SELECT id, published_version_id FROM menu_items WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [menuItemId, rid]); assert(item.rowCount, 'NOT_FOUND', 'Menu item not found', 404); assert(input.status !== 'PUBLISHED' || item.rows[0].published_version_id, 'CONFLICT', 'Publish a menu version before enabling this item', 409); const result = await client.query('UPDATE menu_items SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, category_id, name, description, price, currency, status, allergen_codes, station_code, published_version_id', [menuItemId, input.status]); await audit(client, actor, requestId, 'MENU_ITEM_AVAILABILITY_SET', 'MENU_ITEM', menuItemId);

 return mapMenuItem(result.rows[0]); }); },
    async createRecipe(actor, input: CreateRecipeInput, requestId) {
      write(actor);
      const rid = restaurantId(actor);
      assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Recipe needs at least one ingredient line');
      input.lines.forEach((line) => assert(line.quantity > 0, 'VALIDATION_ERROR', 'Recipe quantity must be greater than zero'));

      return transaction(async (client) => {
        const item = await client.query<{ station_code: string }>('SELECT station_code FROM menu_items WHERE id = $1 AND restaurant_id = $2', [input.menuItemId, rid]);
        assert(item.rowCount, 'NOT_FOUND', 'Menu item not found', 404);
        assert(item.rows[0].station_code === input.stationCode, 'VALIDATION_ERROR', 'Recipe station must match menu item station');
        const ingredientIds = input.lines.map((line) => line.ingredientId);
        const existing = await client.query<{ id: string; stock_unit: string }>('SELECT id, stock_unit FROM ingredients WHERE restaurant_id = $1 AND id = ANY($2::text[]) AND status = \'ACTIVE\'', [rid, ingredientIds]);
        assert(existing.rowCount === ingredientIds.length, 'VALIDATION_ERROR', 'Recipe contains an inactive or unknown ingredient');
        const ingredientsById = new Map(existing.rows.map((row) => [row.id, row]));
        const unitsResult = await client.query<{ code: string; dimension: string; to_base: NumericRow }>('SELECT code, dimension, to_base FROM unit_catalog WHERE status = \'ACTIVE\'');
        const unitByCode = new Map(unitsResult.rows.map((row) => [row.code, row]));

        const canonicalLines = input.lines.map((line) => {
          const ingredient = ingredientsById.get(line.ingredientId);
          const source = unitByCode.get(line.unit);
          const stock = ingredient ? unitByCode.get(ingredient.stock_unit) : undefined;
          assert(source && stock && source.dimension === stock.dimension, 'VALIDATION_ERROR', 'Recipe line unit does not match ingredient stock dimension');

          return { ...line, canonicalQuantity: line.quantity * Number(source.to_base) / Number(stock.to_base) };
        });

        const latest = await client.query<{ version: number }>('SELECT COALESCE(MAX(version), 0)::int AS version FROM recipe_versions WHERE menu_item_id = $1', [input.menuItemId]);
        const id = `recipe_${randomUUID().slice(0, 8)}`;
        await client.query('INSERT INTO recipe_versions (id, menu_item_id, version, station_code) VALUES ($1, $2, $3, $4)', [id, input.menuItemId, latest.rows[0].version + 1, input.stationCode]);

        for (const line of canonicalLines) {
          await client.query('INSERT INTO recipe_lines (recipe_version_id, ingredient_id, quantity, unit, canonical_quantity) VALUES ($1, $2, $3, $4, $5)', [id, line.ingredientId, line.quantity, line.unit, line.canonicalQuantity]);
        }

        await audit(client, actor, requestId, 'RECIPE_CREATED', 'RECIPE_VERSION', id);

        // SAFETY: The recipe version and every line are inserted in this transaction before the DTO is returned.
        return { id, menuItemId: input.menuItemId, version: latest.rows[0].version + 1, status: 'DRAFT', stationCode: input.stationCode, lines: canonicalLines } as RecipeVersion;
      });
    },
    async publishRecipe(actor, recipeId, requestId) { write(actor); const rid = restaurantId(actor);

 return transaction(async (client) => { const recipe = await client.query<{ id: string; menu_item_id: string; version: number; status: RecipeVersion['status']; station_code: RecipeVersion['stationCode']; published_at?: string }>('SELECT rv.id, rv.menu_item_id, rv.version, rv.status, rv.station_code, rv.published_at FROM recipe_versions rv JOIN menu_items mi ON mi.id = rv.menu_item_id WHERE rv.id = $1 AND mi.restaurant_id = $2 FOR UPDATE', [recipeId, rid]); assert(recipe.rowCount, 'NOT_FOUND', 'Recipe not found', 404); const lines = await client.query<{ ingredient_id: string; quantity: NumericRow; unit: string; canonical_quantity?: NumericRow }>('SELECT ingredient_id, quantity, unit, canonical_quantity FROM recipe_lines WHERE recipe_version_id = $1', [recipeId]); assert(lines.rowCount, 'VALIDATION_ERROR', 'Recipe needs at least one ingredient line'); await client.query('UPDATE recipe_versions SET status = \'RETIRED\' WHERE menu_item_id = $1 AND status = \'PUBLISHED\'', [recipe.rows[0].menu_item_id]); const result = await client.query('UPDATE recipe_versions SET status = \'PUBLISHED\', published_at = now() WHERE id = $1 RETURNING id, menu_item_id, version, status, station_code, published_at', [recipeId]); await audit(client, actor, requestId, 'RECIPE_PUBLISHED', 'RECIPE_VERSION', recipeId); const row = result.rows[0];

 // SAFETY: The returned version is locked, scoped to the actor restaurant, and its lines were read by recipe_version_id.
 return { id: row.id, menuItemId: row.menu_item_id, version: row.version, status: row.status, stationCode: row.station_code, publishedAt: row.published_at, lines: lines.rows.map((line): RecipeLine => ({ ingredientId: line.ingredient_id, quantity: Number(line.quantity), unit: line.unit, canonicalQuantity: line.canonical_quantity === null || line.canonical_quantity === undefined ? undefined : Number(line.canonical_quantity) })) } as RecipeVersion; }); },
    async getBohWorkspace(actor, branchId): Promise<BohWorkspace> {
      assertBranchScope(actor, branchId);

      const [poRows, poLineRows, receiptRows, receiptLineRows, balanceRows, requestRows, requestLineRows, countRows, countLineRows, wastageRows, ledgerRows] = await Promise.all([
        pool.query('SELECT id, branch_id, supplier_id, status, created_at, updated_at FROM purchase_orders WHERE branch_id = $1 ORDER BY updated_at DESC', [branchId]),
        pool.query('SELECT pol.id, pol.purchase_order_id, pol.ingredient_id, pol.ordered_quantity, pol.received_quantity, pol.unit FROM purchase_order_lines pol JOIN purchase_orders po ON po.id = pol.purchase_order_id WHERE po.branch_id = $1', [branchId]),
        pool.query('SELECT id, branch_id, purchase_order_id, status, confirmed_at, created_at FROM goods_receipts WHERE branch_id = $1 ORDER BY created_at DESC', [branchId]),
        pool.query('SELECT grl.goods_receipt_id, grl.ingredient_id, grl.accepted_quantity, grl.damaged_quantity, grl.rejected_quantity, grl.unit, grl.note FROM goods_receipt_lines grl JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id WHERE gr.branch_id = $1', [branchId]),
        pool.query('SELECT sb.location_id, sl.label AS location_label, sl.kind AS location_kind, sb.ingredient_id, sb.quantity, sb.unit, sb.updated_at FROM stock_balances sb JOIN stock_locations sl ON sl.id = sb.location_id WHERE sl.branch_id = $1 OR sl.kind = \'WAREHOUSE\'', [branchId]),
        pool.query('SELECT sr.id, sr.from_location_id, sr.to_location_id, sr.status, sr.reason, sr.created_at, sr.updated_at FROM stock_requests sr JOIN stock_locations sl ON sl.id = sr.to_location_id WHERE sl.branch_id = $1 ORDER BY sr.updated_at DESC', [branchId]),
        pool.query('SELECT srl.stock_request_id, srl.ingredient_id, srl.requested_quantity, srl.approved_quantity, srl.shipped_quantity, srl.received_quantity, srl.unit FROM stock_request_lines srl JOIN stock_requests sr ON sr.id = srl.stock_request_id JOIN stock_locations sl ON sl.id = sr.to_location_id WHERE sl.branch_id = $1', [branchId]),
        pool.query('SELECT id, branch_id, business_date, status, submitted_at, created_at FROM daily_counts WHERE branch_id = $1 ORDER BY business_date DESC', [branchId]),
        pool.query('SELECT dcl.daily_count_id, dcl.ingredient_id, dcl.opening_quantity, dcl.received_quantity, dcl.theoretical_sold_quantity, dcl.theoretical_sold_status, dcl.closing_quantity, dcl.variance_quantity, dcl.unit FROM daily_count_lines dcl JOIN daily_counts dc ON dc.id = dcl.daily_count_id WHERE dc.branch_id = $1', [branchId]),
        pool.query('SELECT id, branch_id, ingredient_id, quantity, unit, reason, standard_price, value, status, note, created_at FROM wastage_records WHERE branch_id = $1 ORDER BY created_at DESC', [branchId]),
        pool.query('SELECT il.id, il.location_id, il.ingredient_id, il.quantity_delta, il.unit, il.event_type, il.source_type, il.source_id, il.created_at FROM inventory_ledger il JOIN stock_locations sl ON sl.id = il.location_id WHERE sl.branch_id = $1 OR sl.kind = \'WAREHOUSE\' ORDER BY il.created_at DESC LIMIT 100', [branchId])
      ]);

      // SAFETY: The query selects every column in this domain row shape, and the repository maps numeric values explicitly below.
      const poLines = poLineRows.rows as { id: string; purchase_order_id: string; ingredient_id: string; ordered_quantity: NumericRow; received_quantity: NumericRow; unit: string }[];

      // SAFETY: The query selects every column in this domain row shape, and the repository maps numeric values explicitly below.
      const receiptLines = receiptLineRows.rows as { goods_receipt_id: string; ingredient_id: string; accepted_quantity: NumericRow; damaged_quantity: NumericRow; rejected_quantity: NumericRow; unit: string; note?: string }[];

      // SAFETY: The query selects every column in this domain row shape, and the repository maps numeric values explicitly below.
      const requestLines = requestLineRows.rows as { stock_request_id: string; ingredient_id: string; requested_quantity: NumericRow; approved_quantity?: NumericRow; shipped_quantity?: NumericRow; received_quantity?: NumericRow; unit: string }[];

      // SAFETY: The query selects every column in this domain row shape, and the repository maps numeric values explicitly below.
      const countLines = countLineRows.rows as { daily_count_id: string; ingredient_id: string; opening_quantity: NumericRow; received_quantity: NumericRow; theoretical_sold_quantity?: NumericRow; theoretical_sold_status: string; closing_quantity: NumericRow; variance_quantity: NumericRow; unit: string }[];

      return {
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        purchaseOrders: poRows.rows.map((row) => ({ id: row.id, branchId: row.branch_id, supplierId: row.supplier_id, status: row.status, lines: poLines.filter((line) => line.purchase_order_id === row.id).map((line) => ({ id: line.id, ingredientId: line.ingredient_id, orderedQuantity: Number(line.ordered_quantity), receivedQuantity: Number(line.received_quantity), unit: line.unit })), createdAt: row.created_at, updatedAt: row.updated_at } as PurchaseOrder)),
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        receipts: receiptRows.rows.map((row) => ({ id: row.id, branchId: row.branch_id, purchaseOrderId: row.purchase_order_id, status: row.status, lines: receiptLines.filter((line) => line.goods_receipt_id === row.id).map((line) => ({ ingredientId: line.ingredient_id, acceptedQuantity: Number(line.accepted_quantity), damagedQuantity: Number(line.damaged_quantity), rejectedQuantity: Number(line.rejected_quantity), unit: line.unit, note: line.note ?? undefined })), confirmedAt: row.confirmed_at ?? undefined, createdAt: row.created_at } as GoodsReceipt)),
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        stockBalances: balanceRows.rows.map((row) => ({ locationId: row.location_id, locationLabel: row.location_label, locationKind: row.location_kind, ingredientId: row.ingredient_id, quantity: Number(row.quantity), unit: row.unit, updatedAt: row.updated_at } as StockBalance)),
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        stockRequests: requestRows.rows.map((row) => ({ id: row.id, fromLocationId: row.from_location_id, toLocationId: row.to_location_id, status: row.status, reason: row.reason, lines: requestLines.filter((line) => line.stock_request_id === row.id).map((line) => ({ ingredientId: line.ingredient_id, requestedQuantity: Number(line.requested_quantity), approvedQuantity: line.approved_quantity === undefined ? undefined : Number(line.approved_quantity), shippedQuantity: line.shipped_quantity === undefined ? undefined : Number(line.shipped_quantity), receivedQuantity: line.received_quantity === undefined ? undefined : Number(line.received_quantity), unit: line.unit })), createdAt: row.created_at, updatedAt: row.updated_at } as StockRequest)),
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        dailyCounts: countRows.rows.map((row) => ({ id: row.id, branchId: row.branch_id, businessDate: row.business_date, status: row.status, submittedAt: row.submitted_at ?? undefined, lines: countLines.filter((line) => line.daily_count_id === row.id).map((line) => ({ ingredientId: line.ingredient_id, openingQuantity: Number(line.opening_quantity), receivedQuantity: Number(line.received_quantity), theoreticalSoldQuantity: line.theoretical_sold_quantity === undefined ? undefined : Number(line.theoretical_sold_quantity), theoreticalSoldStatus: line.theoretical_sold_status, closingQuantity: Number(line.closing_quantity), varianceQuantity: Number(line.variance_quantity), unit: line.unit })), createdAt: row.created_at } as DailyCount)),
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        wastage: wastageRows.rows.map((row) => ({ id: row.id, branchId: row.branch_id, ingredientId: row.ingredient_id, quantity: Number(row.quantity), unit: row.unit, reason: row.reason, standardPrice: Number(row.standard_price), value: Number(row.value), status: row.status, note: row.note ?? undefined, createdAt: row.created_at } as WastageRecord)),
        // SAFETY: Each projection is built only from rows returned by the branch-scoped queries above.
        ledger: ledgerRows.rows.map((row) => ({ id: row.id, locationId: row.location_id, ingredientId: row.ingredient_id, quantityDelta: Number(row.quantity_delta), unit: row.unit, eventType: row.event_type, sourceType: row.source_type, sourceId: row.source_id, createdAt: row.created_at } as StockLedgerEntry))
      };
    },
    async createPurchaseOrder(actor, input: CreatePurchaseOrderInput, requestId, idempotencyKey) {
      write(actor); assertBranchScope(actor, input.branchId); assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Purchase order needs at least one line'); const rid = restaurantId(actor);

      return transaction(async (client) => {
        const old = await replay<PurchaseOrder>(client, actor, idempotencyKey, 'PURCHASE_ORDER_CREATE');

 if (old) return old;
        const supplier = await client.query('SELECT id FROM suppliers WHERE id = $1 AND restaurant_id = $2 AND status = \'ACTIVE\'', [input.supplierId, rid]); assert(supplier.rowCount, 'NOT_FOUND', 'Supplier not found', 404);
        const id = `po_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO purchase_orders (id, restaurant_id, branch_id, supplier_id) VALUES ($1, $2, $3, $4)', [id, rid, input.branchId, input.supplierId]); const lines: PurchaseOrder['lines'] = [];

        for (const inputLine of input.lines) { assert(inputLine.orderedQuantity > 0, 'VALIDATION_ERROR', 'Ordered quantity must be greater than zero'); const ingredient = await client.query('SELECT id FROM ingredients WHERE id = $1 AND restaurant_id = $2 AND status = \'ACTIVE\'', [inputLine.ingredientId, rid]); assert(ingredient.rowCount, 'NOT_FOUND', 'Ingredient not found', 404); const lineId = `po_line_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO purchase_order_lines (id, purchase_order_id, ingredient_id, ordered_quantity, unit) VALUES ($1, $2, $3, $4, $5)', [lineId, id, inputLine.ingredientId, inputLine.orderedQuantity, inputLine.unit]); lines.push({ id: lineId, ingredientId: inputLine.ingredientId, orderedQuantity: inputLine.orderedQuantity, receivedQuantity: 0, unit: inputLine.unit }); }

        const now = new Date().toISOString(); const response: PurchaseOrder = { id, branchId: input.branchId, supplierId: input.supplierId, status: 'DRAFT', lines, createdAt: now, updatedAt: now }; await audit(client, actor, requestId, 'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER', id, input.branchId); await remember(client, actor, idempotencyKey, 'PURCHASE_ORDER_CREATE', response);

 return response;
      });
    },
    async commandPurchaseOrder(actor, purchaseOrderId, command, requestId, idempotencyKey) {
      write(actor);

 return transaction(async (client) => { const old = await replay<PurchaseOrder>(client, actor, idempotencyKey, `PURCHASE_ORDER_${command.toUpperCase()}`);

 if (old) return old; const po = await client.query<{ id: string; branch_id: string; supplier_id: string; status: PurchaseOrder['status']; created_at: string; updated_at: string }>('SELECT id, branch_id, supplier_id, status, created_at, updated_at FROM purchase_orders WHERE id = $1 FOR UPDATE', [purchaseOrderId]); assert(po.rowCount, 'NOT_FOUND', 'Purchase order not found', 404); assertBranchScope(actor, po.rows[0].branch_id); const nextStatus: PurchaseOrder['status'] = command === 'send' ? 'SENT' : 'CANCELLED'; assert(command === 'send' ? po.rows[0].status === 'DRAFT' : (po.rows[0].status === 'DRAFT' || po.rows[0].status === 'SENT'), 'CONFLICT', 'Purchase order cannot transition from this state', 409); await client.query('UPDATE purchase_orders SET status = $2, updated_at = now() WHERE id = $1', [purchaseOrderId, nextStatus]); const lines = await client.query('SELECT id, ingredient_id, ordered_quantity, received_quantity, unit FROM purchase_order_lines WHERE purchase_order_id = $1', [purchaseOrderId]); const response: PurchaseOrder = { id: po.rows[0].id, branchId: po.rows[0].branch_id, supplierId: po.rows[0].supplier_id, status: nextStatus, lines: lines.rows.map((line) => ({ id: line.id, ingredientId: line.ingredient_id, orderedQuantity: Number(line.ordered_quantity), receivedQuantity: Number(line.received_quantity), unit: line.unit })), createdAt: po.rows[0].created_at, updatedAt: new Date().toISOString() }; await audit(client, actor, requestId, `PURCHASE_ORDER_${command.toUpperCase()}`, 'PURCHASE_ORDER', purchaseOrderId, po.rows[0].branch_id); await remember(client, actor, idempotencyKey, `PURCHASE_ORDER_${command.toUpperCase()}`, response);

 return response; });
    },
    async confirmGoodsReceipt(actor, input: ConfirmGoodsReceiptInput, requestId, idempotencyKey) {
      write(actor); assertBranchScope(actor, input.branchId); assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Receipt needs at least one line');

      return transaction(async (client) => {
        const old = await replay<GoodsReceipt>(client, actor, idempotencyKey, 'GOODS_RECEIPT_CONFIRM');

 if (old) return old;
        const po = await client.query<{ id: string; status: PurchaseOrder['status']; branch_id: string }>('SELECT id, status, branch_id FROM purchase_orders WHERE id = $1 AND branch_id = $2 FOR UPDATE', [input.purchaseOrderId, input.branchId]); assert(po.rowCount, 'NOT_FOUND', 'Purchase order not found', 404); assert(po.rows[0].status !== 'CANCELLED' && po.rows[0].status !== 'RECEIVED', 'CONFLICT', 'Purchase order cannot receive more goods', 409);
        const warehouse = await client.query<{ id: string }>('SELECT id FROM stock_locations WHERE kind = \'WAREHOUSE\' AND status = \'ACTIVE\' ORDER BY id LIMIT 1 FOR UPDATE'); assert(warehouse.rowCount, 'CONFLICT', 'Warehouse location is not configured', 409); const receiptId = `receipt_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO goods_receipts (id, branch_id, purchase_order_id, status, confirmed_at) VALUES ($1, $2, $3, \'CONFIRMED\', now())', [receiptId, input.branchId, input.purchaseOrderId]);

        for (const line of input.lines) { const total = line.acceptedQuantity + line.damagedQuantity + line.rejectedQuantity; assert(total > 0, 'VALIDATION_ERROR', 'Receipt quantity must be greater than zero'); const orderLine = await client.query<{ id: string; ordered_quantity: NumericRow; received_quantity: NumericRow }>('SELECT id, ordered_quantity, received_quantity FROM purchase_order_lines WHERE purchase_order_id = $1 AND ingredient_id = $2 FOR UPDATE', [input.purchaseOrderId, line.ingredientId]); assert(orderLine.rowCount, 'VALIDATION_ERROR', 'Receipt line is not on the purchase order'); assert(Number(orderLine.rows[0].received_quantity) + total <= Number(orderLine.rows[0].ordered_quantity), 'CONFLICT', 'Receipt exceeds ordered quantity', 409); await client.query('INSERT INTO goods_receipt_lines (goods_receipt_id, ingredient_id, accepted_quantity, damaged_quantity, rejected_quantity, unit, note) VALUES ($1, $2, $3, $4, $5, $6, $7)', [receiptId, line.ingredientId, line.acceptedQuantity, line.damagedQuantity, line.rejectedQuantity, line.unit, line.note ?? null]); await client.query('UPDATE purchase_order_lines SET received_quantity = received_quantity + $3 WHERE id = $1 AND purchase_order_id = $2', [orderLine.rows[0].id, input.purchaseOrderId, total]);

 if (line.acceptedQuantity > 0) { await client.query('INSERT INTO stock_balances (location_id, ingredient_id, quantity, unit) VALUES ($1, $2, $3, $4) ON CONFLICT (location_id, ingredient_id) DO UPDATE SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = now()', [warehouse.rows[0].id, line.ingredientId, line.acceptedQuantity, line.unit]); await client.query('INSERT INTO inventory_ledger (id, location_id, ingredient_id, quantity_delta, unit, event_type, source_type, source_id, idempotency_key, actor_id) VALUES ($1, $2, $3, $4, $5, \'GOODS_RECEIPT_CONFIRMED\', \'GOODS_RECEIPT\', $6, $7, $8)', [`ledger_${randomUUID().slice(0, 8)}`, warehouse.rows[0].id, line.ingredientId, line.acceptedQuantity, line.unit, receiptId, `${idempotencyKey}:${line.ingredientId}`, actor.id]); } }

        const refreshed = await client.query<{ ordered_quantity: NumericRow; received_quantity: NumericRow }>('SELECT ordered_quantity, received_quantity FROM purchase_order_lines WHERE purchase_order_id = $1', [input.purchaseOrderId]); const status: PurchaseOrder['status'] = refreshed.rows.every((line) => Number(line.received_quantity) >= Number(line.ordered_quantity)) ? 'RECEIVED' : 'PARTIALLY_RECEIVED'; await client.query('UPDATE purchase_orders SET status = $2, updated_at = now() WHERE id = $1', [input.purchaseOrderId, status]); const response: GoodsReceipt = { id: receiptId, branchId: input.branchId, purchaseOrderId: input.purchaseOrderId, status: 'CONFIRMED', lines: input.lines, confirmedAt: new Date().toISOString(), createdAt: new Date().toISOString() }; await audit(client, actor, requestId, 'GOODS_RECEIPT_CONFIRMED', 'GOODS_RECEIPT', receiptId, input.branchId); await remember(client, actor, idempotencyKey, 'GOODS_RECEIPT_CONFIRM', response);

 return response;
      });
    },
    async createStockRequest(actor, input: CreateStockRequestInput, requestId, idempotencyKey) {
      write(actor); assert(input.lines.length > 0 && input.reason.trim().length >= 3, 'VALIDATION_ERROR', 'Stock request needs a reason and line');

      return transaction(async (client) => { const old = await replay<StockRequest>(client, actor, idempotencyKey, 'STOCK_REQUEST_CREATE');

 if (old) return old; const locations = await client.query<{ id: string; branch_id?: string }>('SELECT id, branch_id FROM stock_locations WHERE id = ANY($1::text[]) AND status = \'ACTIVE\'', [[input.fromLocationId, input.toLocationId]]); assert(locations.rowCount === 2, 'NOT_FOUND', 'Stock location not found', 404); const destination = locations.rows.find((row) => row.id === input.toLocationId); assert(destination?.branch_id, 'VALIDATION_ERROR', 'Destination must be a branch location'); assertBranchScope(actor, destination.branch_id); const id = `request_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO stock_requests (id, from_location_id, to_location_id, reason) VALUES ($1, $2, $3, $4)', [id, input.fromLocationId, input.toLocationId, input.reason.trim()]); const lines: StockRequest['lines'] = [];

 for (const line of input.lines) { assert(line.requestedQuantity > 0, 'VALIDATION_ERROR', 'Requested quantity must be greater than zero'); await client.query('INSERT INTO stock_request_lines (stock_request_id, ingredient_id, requested_quantity, unit) VALUES ($1, $2, $3, $4)', [id, line.ingredientId, line.requestedQuantity, line.unit]); lines.push({ ingredientId: line.ingredientId, requestedQuantity: line.requestedQuantity, unit: line.unit }); }

 const now = new Date().toISOString(); const response: StockRequest = { id, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, status: 'REQUESTED', lines, reason: input.reason.trim(), createdAt: now, updatedAt: now }; await audit(client, actor, requestId, 'STOCK_REQUEST_CREATED', 'STOCK_REQUEST', id, destination.branch_id); await remember(client, actor, idempotencyKey, 'STOCK_REQUEST_CREATE', response);

 return response; });
    },
    async commandStockRequest(actor, requestIdId, command, input) {
      write(actor);

      return transaction(async (client) => { const old = await replay<StockRequest>(client, actor, input.idempotencyKey, `STOCK_REQUEST_${command.toUpperCase()}`);

 if (old) return old; const result = await client.query<{ id: string; from_location_id: string; to_location_id: string; status: StockRequest['status']; reason: string; created_at: string; updated_at: string }>('SELECT sr.id, sr.from_location_id, sr.to_location_id, sr.status, sr.reason, sr.created_at, sr.updated_at FROM stock_requests sr JOIN stock_locations sl ON sl.id = sr.to_location_id WHERE sr.id = $1 FOR UPDATE', [requestIdId]); assert(result.rowCount, 'NOT_FOUND', 'Stock request not found', 404); const request = result.rows[0]; const destination = await client.query<{ branch_id: string }>('SELECT branch_id FROM stock_locations WHERE id = $1', [request.to_location_id]); assert(destination.rowCount && destination.rows[0].branch_id, 'VALIDATION_ERROR', 'Destination must be a branch location'); assertBranchScope(actor, destination.rows[0].branch_id); const linesResult = await client.query<{ ingredient_id: string; requested_quantity: NumericRow; approved_quantity?: NumericRow; shipped_quantity?: NumericRow; received_quantity?: NumericRow; unit: string }>('SELECT ingredient_id, requested_quantity, approved_quantity, shipped_quantity, received_quantity, unit FROM stock_request_lines WHERE stock_request_id = $1 FOR UPDATE', [request.id]);

 if (command === 'approve') { assert(request.status === 'REQUESTED', 'CONFLICT', 'Only requested stock transfers can be approved', 409); await client.query('UPDATE stock_requests SET status = \'APPROVED\', updated_at = now() WHERE id = $1', [request.id]); await client.query('UPDATE stock_request_lines SET approved_quantity = requested_quantity WHERE stock_request_id = $1', [request.id]); }

 if (command === 'reject') { assert(request.status === 'REQUESTED', 'CONFLICT', 'Only requested stock transfers can be rejected', 409); assert(input.reason?.trim(), 'VALIDATION_ERROR', 'Rejection reason is required'); await client.query('UPDATE stock_requests SET status = \'REJECTED\', updated_at = now(), reason = reason || $2 WHERE id = $1', [request.id, ` · Rejected: ${input.reason.trim()}`]); }

 if (command === 'ship') { assert(request.status === 'APPROVED', 'CONFLICT', 'Only approved stock transfers can ship', 409);

 for (const line of linesResult.rows) { const qty = Number(line.approved_quantity ?? line.requested_quantity); const balance = await client.query<{ quantity: NumericRow }>('SELECT quantity FROM stock_balances WHERE location_id = $1 AND ingredient_id = $2 FOR UPDATE', [request.from_location_id, line.ingredient_id]); assert(balance.rowCount && Number(balance.rows[0].quantity) >= qty, 'CONFLICT', 'Insufficient available stock', 409); await client.query('UPDATE stock_balances SET quantity = quantity - $3, updated_at = now() WHERE location_id = $1 AND ingredient_id = $2', [request.from_location_id, line.ingredient_id, qty]); await client.query('INSERT INTO inventory_ledger (id, location_id, ingredient_id, quantity_delta, unit, event_type, source_type, source_id, idempotency_key, actor_id) VALUES ($1, $2, $3, $4, $5, \'STOCK_SHIPPED\', \'STOCK_REQUEST\', $6, $7, $8)', [`ledger_${randomUUID().slice(0, 8)}`, request.from_location_id, line.ingredient_id, -qty, line.unit, request.id, `${input.idempotencyKey}:${line.ingredient_id}`, actor.id]); }

 await client.query('UPDATE stock_request_lines SET shipped_quantity = COALESCE(approved_quantity, requested_quantity) WHERE stock_request_id = $1', [request.id]); await client.query('UPDATE stock_requests SET status = \'IN_TRANSIT\', updated_at = now() WHERE id = $1', [request.id]); }

 if (command === 'accept') { assert(request.status === 'IN_TRANSIT', 'CONFLICT', 'Only in-transit stock transfers can be accepted', 409);

 for (const line of linesResult.rows) { const qty = Number(line.shipped_quantity ?? 0); await client.query('INSERT INTO stock_balances (location_id, ingredient_id, quantity, unit) VALUES ($1, $2, $3, $4) ON CONFLICT (location_id, ingredient_id) DO UPDATE SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = now()', [request.to_location_id, line.ingredient_id, qty, line.unit]); await client.query('INSERT INTO inventory_ledger (id, location_id, ingredient_id, quantity_delta, unit, event_type, source_type, source_id, idempotency_key, actor_id) VALUES ($1, $2, $3, $4, $5, \'STOCK_RECEIVED\', \'STOCK_REQUEST\', $6, $7, $8)', [`ledger_${randomUUID().slice(0, 8)}`, request.to_location_id, line.ingredient_id, qty, line.unit, request.id, `${input.idempotencyKey}:${line.ingredient_id}`, actor.id]); }

 await client.query('UPDATE stock_request_lines SET received_quantity = shipped_quantity WHERE stock_request_id = $1', [request.id]); await client.query('UPDATE stock_requests SET status = \'CLOSED\', updated_at = now() WHERE id = $1', [request.id]); }

 const updated = await client.query('SELECT id, from_location_id, to_location_id, status, reason, created_at, updated_at FROM stock_requests WHERE id = $1', [request.id]); const updatedLines = await client.query('SELECT ingredient_id, requested_quantity, approved_quantity, shipped_quantity, received_quantity, unit FROM stock_request_lines WHERE stock_request_id = $1', [request.id]); const response: StockRequest = { id: updated.rows[0].id, fromLocationId: updated.rows[0].from_location_id, toLocationId: updated.rows[0].to_location_id, status: updated.rows[0].status, reason: updated.rows[0].reason, lines: updatedLines.rows.map((line) => ({ ingredientId: line.ingredient_id, requestedQuantity: Number(line.requested_quantity), approvedQuantity: line.approved_quantity === null ? undefined : Number(line.approved_quantity), shippedQuantity: line.shipped_quantity === null ? undefined : Number(line.shipped_quantity), receivedQuantity: line.received_quantity === null ? undefined : Number(line.received_quantity), unit: line.unit })), createdAt: updated.rows[0].created_at, updatedAt: updated.rows[0].updated_at }; await audit(client, actor, requestIdId, `STOCK_REQUEST_${command.toUpperCase()}`, 'STOCK_REQUEST', request.id, destination.rows[0].branch_id); await remember(client, actor, input.idempotencyKey, `STOCK_REQUEST_${command.toUpperCase()}`, response);

 return response; });
    },
    async createDailyCount(actor, input: CreateDailyCountInput, requestId, idempotencyKey) {
      write(actor); assertBranchScope(actor, input.branchId);

 return transaction(async (client) => { const old = await replay<DailyCount>(client, actor, idempotencyKey, 'DAILY_COUNT_CREATE');

 if (old) return old; const id = `count_${randomUUID().slice(0, 8)}`; await client.query('INSERT INTO daily_counts (id, branch_id, business_date) VALUES ($1, $2, $3)', [id, input.branchId, input.businessDate]); const lines: DailyCount['lines'] = [];

 for (const line of input.lines) { const status = line.theoreticalSoldQuantity === undefined ? 'INCOMPLETE_THEORY' : 'AVAILABLE'; const variance = status === 'AVAILABLE' ? line.closingQuantity - (line.openingQuantity + line.receivedQuantity - line.theoreticalSoldQuantity!) : 0; await client.query('INSERT INTO daily_count_lines (daily_count_id, ingredient_id, opening_quantity, received_quantity, theoretical_sold_quantity, theoretical_sold_status, closing_quantity, variance_quantity, unit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, line.ingredientId, line.openingQuantity, line.receivedQuantity, line.theoreticalSoldQuantity ?? null, status, line.closingQuantity, variance, line.unit]); lines.push({ ...line, varianceQuantity: variance, theoreticalSoldStatus: status }); }

 const response: DailyCount = { id, branchId: input.branchId, businessDate: input.businessDate, status: 'DRAFT', lines, createdAt: new Date().toISOString() }; await audit(client, actor, requestId, 'DAILY_COUNT_CREATED', 'DAILY_COUNT', id, input.branchId); await remember(client, actor, idempotencyKey, 'DAILY_COUNT_CREATE', response);

 return response; });
    },
    async submitDailyCount(actor, countId, requestId, idempotencyKey) { write(actor);

 return transaction(async (client) => { const old = await replay<DailyCount>(client, actor, idempotencyKey, 'DAILY_COUNT_SUBMIT');

 if (old) return old; const count = await client.query<{ id: string; branch_id: string; business_date: string; status: DailyCount['status']; created_at: string; submitted_at?: string }>('SELECT id, branch_id, business_date, status, created_at, submitted_at FROM daily_counts WHERE id = $1 FOR UPDATE', [countId]); assert(count.rowCount, 'NOT_FOUND', 'Daily count not found', 404); assertBranchScope(actor, count.rows[0].branch_id); assert(count.rows[0].status === 'DRAFT' || count.rows[0].status === 'REJECTED', 'CONFLICT', 'Daily count cannot be submitted in this state', 409); await client.query('UPDATE daily_counts SET status = \'SUBMITTED\', submitted_at = now() WHERE id = $1', [countId]); const lines = await client.query('SELECT ingredient_id, opening_quantity, received_quantity, theoretical_sold_quantity, theoretical_sold_status, closing_quantity, variance_quantity, unit FROM daily_count_lines WHERE daily_count_id = $1', [countId]);

 // SAFETY: The row is selected by primary key, branch scope is checked, and the mapped fields match DailyCount's persisted contract.
 const response = { id: countId, branchId: count.rows[0].branch_id, businessDate: count.rows[0].business_date, status: 'SUBMITTED', lines: lines.rows.map((line) => ({ ingredientId: line.ingredient_id, openingQuantity: Number(line.opening_quantity), receivedQuantity: Number(line.received_quantity), theoreticalSoldQuantity: line.theoretical_sold_quantity === null ? undefined : Number(line.theoretical_sold_quantity), theoreticalSoldStatus: line.theoretical_sold_status, closingQuantity: Number(line.closing_quantity), varianceQuantity: Number(line.variance_quantity), unit: line.unit })), submittedAt: new Date().toISOString(), createdAt: count.rows[0].created_at } as DailyCount; await audit(client, actor, requestId, 'DAILY_COUNT_SUBMITTED', 'DAILY_COUNT', countId, count.rows[0].branch_id); await remember(client, actor, idempotencyKey, 'DAILY_COUNT_SUBMIT', response);

 return response; }); },
    async createWastage(actor, input: CreateWastageInput, requestId, idempotencyKey) { write(actor); assertBranchScope(actor, input.branchId); assert(input.quantity > 0 && input.reason.trim().length >= 3, 'VALIDATION_ERROR', 'Wastage quantity and reason are required'); const rid = restaurantId(actor);

 return transaction(async (client) => { const old = await replay<WastageRecord>(client, actor, idempotencyKey, 'WASTAGE_CREATE');

 if (old) return old; const ingredient = await client.query<{ standard_cost: NumericRow }>('SELECT standard_cost FROM ingredients WHERE id = $1 AND restaurant_id = $2 AND status = \'ACTIVE\'', [input.ingredientId, rid]); assert(ingredient.rowCount, 'NOT_FOUND', 'Ingredient not found', 404); const id = `wastage_${randomUUID().slice(0, 8)}`; const standardPrice = Number(ingredient.rows[0].standard_cost); const value = standardPrice * input.quantity; await client.query('INSERT INTO wastage_records (id, branch_id, ingredient_id, quantity, unit, reason, standard_price, value, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, input.branchId, input.ingredientId, input.quantity, input.unit, input.reason.trim(), standardPrice, value, input.note?.trim() ?? null]); const response: WastageRecord = { id, branchId: input.branchId, ingredientId: input.ingredientId, quantity: input.quantity, unit: input.unit, reason: input.reason.trim(), standardPrice, value, status: 'DRAFT', note: input.note?.trim(), createdAt: new Date().toISOString() }; await audit(client, actor, requestId, 'WASTAGE_CREATED', 'WASTAGE', id, input.branchId); await remember(client, actor, idempotencyKey, 'WASTAGE_CREATE', response);

 return response; }); },
    async submitWastage(actor, wastageId, requestId, idempotencyKey) { write(actor);

 return transaction(async (client) => { const old = await replay<WastageRecord>(client, actor, idempotencyKey, 'WASTAGE_SUBMIT');

 if (old) return old; const row = await client.query<{ id: string; branch_id: string; ingredient_id: string; quantity: NumericRow; unit: string; reason: string; standard_price: NumericRow; value: NumericRow; status: WastageRecord['status']; note?: string; created_at: string }>('SELECT id, branch_id, ingredient_id, quantity, unit, reason, standard_price, value, status, note, created_at FROM wastage_records WHERE id = $1 FOR UPDATE', [wastageId]); assert(row.rowCount, 'NOT_FOUND', 'Wastage record not found', 404); assertBranchScope(actor, row.rows[0].branch_id); assert(row.rows[0].status === 'DRAFT' || row.rows[0].status === 'REJECTED', 'CONFLICT', 'Wastage cannot be submitted in this state', 409); await client.query('UPDATE wastage_records SET status = \'SUBMITTED\' WHERE id = $1', [wastageId]);

 // SAFETY: The row is selected by primary key, branch scope is checked, and the mapped fields match WastageRecord's persisted contract.
 const value = { id: row.rows[0].id, branchId: row.rows[0].branch_id, ingredientId: row.rows[0].ingredient_id, quantity: Number(row.rows[0].quantity), unit: row.rows[0].unit, reason: row.rows[0].reason, standardPrice: Number(row.rows[0].standard_price), value: Number(row.rows[0].value), status: 'SUBMITTED', note: row.rows[0].note ?? undefined, createdAt: row.rows[0].created_at } as WastageRecord; await audit(client, actor, requestId, 'WASTAGE_SUBMITTED', 'WASTAGE', wastageId, row.rows[0].branch_id); await remember(client, actor, idempotencyKey, 'WASTAGE_SUBMIT', value);

 return value; }); }
  };
}
