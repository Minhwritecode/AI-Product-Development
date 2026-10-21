import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Actor, RoleCode } from '../platform/types.js';
import type {
  CreateAssignmentInput, CreateCategoryInput, CreateIngredientInput, CreateMenuItemInput, CreateMenuVersionInput, CreateModifierGroupInput, CreateRecipeInput, CreateStationAssignmentInput,
  CreateShiftInput, CreateStaffInput, CreateSupplierInput, CreateTaskInput, Ingredient, MasterDataOverview,
  MenuCategory, MenuItem, MenuVersion, ModifierGroup, OperationalTask, OperationsRepository, RecipeLine,
  RecipeVersion, Shift, ShiftAssignment, StaffProfile, StaffWorkspace, Supplier, SetMenuItemAllergensInput, SetMenuItemAvailabilityInput, StationAssignment, UnitDefinition, Allergen
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
 return { id: row.id, menuItemId: row.menu_item_id, version: row.version, status: row.status, stationCode: row.station_code, publishedAt: row.published_at, lines: lines.rows.map((line): RecipeLine => ({ ingredientId: line.ingredient_id, quantity: Number(line.quantity), unit: line.unit, canonicalQuantity: line.canonical_quantity === null || line.canonical_quantity === undefined ? undefined : Number(line.canonical_quantity) })) } as RecipeVersion; }); }
  };
}
