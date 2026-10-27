import { randomUUID } from 'node:crypto';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Actor, RoleCode } from '../platform/types.js';
import type {
  Ingredient,
  MasterDataOverview,
  MenuCategory,
  MenuItem,
  MenuVersion,
  ModifierGroup,
  OperationalTask,
  OperationsRepository,
  RecipeVersion,
  Allergen,
  CreateMenuVersionInput,
  CreateModifierGroupInput,
  CreateStationAssignmentInput,
  SetMenuItemAllergensInput,
  SetMenuItemAvailabilityInput,
  StationAssignment,
  UnitDefinition,
  Shift,
  ShiftAssignment,
  StaffProfile,
  StaffWorkspace,
  Supplier,
  BohWorkspace,
  CreateDailyCountInput,
  CreatePurchaseOrderInput,
  CreateStockRequestInput,
  CreateWastageInput,
  DailyCount,
  GoodsReceipt,
  PurchaseOrder,
  StockRequest,
  StockBalance,
  StockLedgerEntry,
  WastageRecord
} from './types.js';

type AuditEvent = { action: string; entityType: string; entityId: string; actorId: string; requestId: string };

const roles: RoleCode[] = ['OWNER', 'ADMIN', 'MANAGER', 'HOST', 'SERVER', 'KITCHEN', 'BAR', 'CASHIER'];

export function createMemoryOperationsRepository(): OperationsRepository {
  const staff = new Map<string, StaffProfile>([
    ['staff_host', { id: 'staff_host', branchId: 'branch_central', displayName: 'Mai Anh', email: 'mai@luminex.local', status: 'ACTIVE', roleCodes: ['HOST'], stationCodes: ['FRONT_DESK'] }],
    ['staff_server', { id: 'staff_server', branchId: 'branch_central', displayName: 'Minh Quân', email: 'minh@luminex.local', status: 'ACTIVE', roleCodes: ['SERVER'], stationCodes: ['FLOOR'] }],
    ['staff_kitchen', { id: 'staff_kitchen', branchId: 'branch_central', displayName: 'Trang Bếp', email: 'trang@luminex.local', status: 'ACTIVE', roleCodes: ['KITCHEN'], stationCodes: ['KITCHEN'] }],
    ['staff_bar', { id: 'staff_bar', branchId: 'branch_central', displayName: 'Huy Bar', email: 'huy@luminex.local', status: 'ACTIVE', roleCodes: ['BAR'], stationCodes: ['BAR'] }]
  ]);

  const shifts = new Map<string, Shift>([
    ['shift_opening', { id: 'shift_opening', branchId: 'branch_central', label: 'Opening · FOH + BOH', startsAt: '2026-10-20T07:00:00+07:00', endsAt: '2026-10-20T15:00:00+07:00', status: 'OPEN', assignments: [{ id: 'assign_host', shiftId: 'shift_opening', staffId: 'staff_host', roleCode: 'HOST', stationCode: 'FRONT_DESK', status: 'ACCEPTED' }, { id: 'assign_kitchen', shiftId: 'shift_opening', staffId: 'staff_kitchen', roleCode: 'KITCHEN', stationCode: 'KITCHEN', status: 'ACCEPTED' }] }]
  ]);

  const tasks = new Map<string, OperationalTask>([
    ['task_queue', { id: 'task_queue', branchId: 'branch_central', title: 'Kiểm tra hàng chờ front-door QR', sourceType: 'QUEUE', sourceId: 'queue_central', priority: 'HIGH', requiredRole: 'HOST', stationCode: 'FRONT_DESK', ownerId: 'staff_host', dueAt: '2026-10-20T12:00:00+07:00', status: 'IN_PROGRESS', escalationLevel: 0, createdAt: '2026-10-20T08:30:00+07:00', updatedAt: '2026-10-20T09:10:00+07:00' }],
    ['task_count', { id: 'task_count', branchId: 'branch_central', title: 'Xác nhận daily count khu bar', sourceType: 'EXCEPTION', sourceId: 'count_bar', priority: 'NORMAL', requiredRole: 'BAR', stationCode: 'BAR', ownerId: 'staff_bar', dueAt: '2026-10-20T14:30:00+07:00', status: 'OPEN', escalationLevel: 0, createdAt: '2026-10-20T09:00:00+07:00', updatedAt: '2026-10-20T09:00:00+07:00' }]
  ]);

  const stationAssignments = new Map<string, StationAssignment>([
    ['station_assign_host', { id: 'station_assign_host', branchId: 'branch_central', staffId: 'staff_host', roleCode: 'HOST', stationCode: 'FRONT_DESK', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00+07:00' }],
    ['station_assign_server', { id: 'station_assign_server', branchId: 'branch_central', staffId: 'staff_server', roleCode: 'SERVER', stationCode: 'FLOOR', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00+07:00' }],
    ['station_assign_kitchen', { id: 'station_assign_kitchen', branchId: 'branch_central', staffId: 'staff_kitchen', roleCode: 'KITCHEN', stationCode: 'KITCHEN', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00+07:00' }],
    ['station_assign_bar', { id: 'station_assign_bar', branchId: 'branch_central', staffId: 'staff_bar', roleCode: 'BAR', stationCode: 'BAR', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00+07:00' }]
  ]);

  const ingredients = new Map<string, Ingredient>([
    ['ingredient_chicken', { id: 'ingredient_chicken', name: 'Ức gà', purchaseUnit: 'kg', stockUnit: 'g', purchaseToStock: 1000, standardCost: 125000, status: 'ACTIVE' }],
    ['ingredient_coffee', { id: 'ingredient_coffee', name: 'Cà phê hạt Arabica', purchaseUnit: 'kg', stockUnit: 'g', purchaseToStock: 1000, standardCost: 420000, status: 'ACTIVE' }],
    ['ingredient_lettuce', { id: 'ingredient_lettuce', name: 'Xà lách', purchaseUnit: 'kg', stockUnit: 'g', purchaseToStock: 1000, standardCost: 85000, status: 'ACTIVE' }]
  ]);

  const suppliers = new Map<string, Supplier>([['supplier_fresh', { id: 'supplier_fresh', code: 'FRESH-01', name: 'Fresh Farm Central', status: 'ACTIVE' }]]);
  const categories = new Map<string, MenuCategory>([['category_main', { id: 'category_main', name: 'Món chính', sortOrder: 1, status: 'ACTIVE' }], ['category_drinks', { id: 'category_drinks', name: 'Đồ uống', sortOrder: 2, status: 'ACTIVE' }]]);

  const menuItems = new Map<string, MenuItem>([
    ['item_chicken', { id: 'item_chicken', categoryId: 'category_main', name: 'Gà nướng thảo mộc', description: 'Ức gà nướng, salad theo mùa', price: 185000, currency: 'VND', status: 'PUBLISHED', allergenCodes: [], stationCode: 'KITCHEN', publishedVersionId: 'menu_version_chicken' }],
    ['item_coffee', { id: 'item_coffee', categoryId: 'category_drinks', name: 'Cà phê sữa đá', description: 'Arabica rang vừa, sữa đặc', price: 55000, currency: 'VND', status: 'PUBLISHED', allergenCodes: ['MILK'], stationCode: 'BAR', publishedVersionId: 'menu_version_coffee' }]
  ]);

  const menuVersions = new Map<string, MenuVersion>([
    ['menu_version_chicken', { id: 'menu_version_chicken', menuItemId: 'item_chicken', version: 1, price: 185000, effectiveFrom: '2026-10-01T00:00:00+07:00', status: 'PUBLISHED' }],
    ['menu_version_coffee', { id: 'menu_version_coffee', menuItemId: 'item_coffee', version: 1, price: 55000, effectiveFrom: '2026-10-01T00:00:00+07:00', status: 'PUBLISHED' }]
  ]);

  const modifierGroups = new Map<string, ModifierGroup>();

  const units = new Map<string, UnitDefinition>([
    ['g', { code: 'g', dimension: 'MASS', toBase: 1, status: 'ACTIVE' }],
    ['kg', { code: 'kg', dimension: 'MASS', toBase: 1000, status: 'ACTIVE' }],
    ['ml', { code: 'ml', dimension: 'VOLUME', toBase: 1, status: 'ACTIVE' }],
    ['l', { code: 'l', dimension: 'VOLUME', toBase: 1000, status: 'ACTIVE' }],
    ['pcs', { code: 'pcs', dimension: 'COUNT', toBase: 1, status: 'ACTIVE' }],
    ['portion', { code: 'portion', dimension: 'COUNT', toBase: 1, status: 'ACTIVE' }]
  ]);

  const allergens = new Map<string, Allergen>([
    ['MILK', { code: 'MILK', label: 'Sữa', status: 'ACTIVE' }], ['GLUTEN', { code: 'GLUTEN', label: 'Gluten', status: 'ACTIVE' }],
    ['EGG', { code: 'EGG', label: 'Trứng', status: 'ACTIVE' }], ['PEANUT', { code: 'PEANUT', label: 'Đậu phộng', status: 'ACTIVE' }],
    ['TREE_NUT', { code: 'TREE_NUT', label: 'Hạt cây', status: 'ACTIVE' }], ['SOY', { code: 'SOY', label: 'Đậu nành', status: 'ACTIVE' }],
    ['FISH', { code: 'FISH', label: 'Cá', status: 'ACTIVE' }], ['SHELLFISH', { code: 'SHELLFISH', label: 'Giáp xác', status: 'ACTIVE' }],
    ['SESAME', { code: 'SESAME', label: 'Mè', status: 'ACTIVE' }]
  ]);

  const recipes = new Map<string, RecipeVersion>([
    ['recipe_chicken_v1', { id: 'recipe_chicken_v1', menuItemId: 'item_chicken', version: 1, status: 'PUBLISHED', stationCode: 'KITCHEN', publishedAt: '2026-10-01T00:00:00+07:00', lines: [{ ingredientId: 'ingredient_chicken', quantity: 180, unit: 'g' }, { ingredientId: 'ingredient_lettuce', quantity: 80, unit: 'g' }] }]
  ]);

  const locations = new Map<string, { id: string; branchId?: string; kind: 'WAREHOUSE' | 'BRANCH'; label: string }>([
    ['location_warehouse', { id: 'location_warehouse', kind: 'WAREHOUSE', label: 'Central warehouse' }],
    ['location_branch_central', { id: 'location_branch_central', branchId: 'branch_central', kind: 'BRANCH', label: 'Central branch store' }]
  ]);

  const purchaseOrders = new Map<string, PurchaseOrder>([
    ['po_1001', { id: 'po_1001', branchId: 'branch_central', supplierId: 'supplier_fresh', status: 'SENT', lines: [{ id: 'po_line_1001', ingredientId: 'ingredient_chicken', orderedQuantity: 25, receivedQuantity: 18, unit: 'kg' }], createdAt: '2026-10-20T07:10:00+07:00', updatedAt: '2026-10-20T09:00:00+07:00' }]
  ]);

  const receipts = new Map<string, GoodsReceipt>([
    ['receipt_1001', { id: 'receipt_1001', branchId: 'branch_central', purchaseOrderId: 'po_1001', status: 'CONFIRMED', lines: [{ ingredientId: 'ingredient_chicken', acceptedQuantity: 18, damagedQuantity: 0, rejectedQuantity: 0, unit: 'kg' }], confirmedAt: '2026-10-20T09:00:00+07:00', createdAt: '2026-10-20T08:55:00+07:00' }]
  ]);

  const balances = new Map<string, StockBalance>([
    ['location_warehouse:ingredient_chicken', { locationId: 'location_warehouse', locationLabel: 'Central warehouse', locationKind: 'WAREHOUSE', ingredientId: 'ingredient_chicken', quantity: 42, unit: 'kg', updatedAt: '2026-10-20T09:00:00+07:00' }],
    ['location_branch_central:ingredient_chicken', { locationId: 'location_branch_central', locationLabel: 'Central branch store', locationKind: 'BRANCH', ingredientId: 'ingredient_chicken', quantity: 8, unit: 'kg', updatedAt: '2026-10-20T09:00:00+07:00' }]
  ]);

  const ledger: StockLedgerEntry[] = [{ id: 'ledger_receipt_1001', locationId: 'location_warehouse', ingredientId: 'ingredient_chicken', quantityDelta: 18, unit: 'kg', eventType: 'GOODS_RECEIPT_CONFIRMED', sourceType: 'GOODS_RECEIPT', sourceId: 'receipt_1001', createdAt: '2026-10-20T09:00:00+07:00' }];

  const stockRequests = new Map<string, StockRequest>([
    ['request_1001', { id: 'request_1001', fromLocationId: 'location_warehouse', toLocationId: 'location_branch_central', status: 'REQUESTED', reason: 'Bổ sung hàng trước giờ cao điểm tối', lines: [{ ingredientId: 'ingredient_chicken', requestedQuantity: 6, unit: 'kg' }], createdAt: '2026-10-20T10:00:00+07:00', updatedAt: '2026-10-20T10:00:00+07:00' }]
  ]);

  const dailyCounts = new Map<string, DailyCount>();
  const wastage = new Map<string, WastageRecord>();
  const idempotency = new Map<string, unknown>();

  const auditEvents: AuditEvent[] = [];

  function audit(action: string, entityType: string, entityId: string, actor: Actor, requestId: string) {
    auditEvents.push({ action, entityType, entityId, actorId: actor.id, requestId });
  }

  function branchCheck(actor: Actor, branchId: string) { assertBranchScope(actor, branchId); }

  function managerWrite(actor: Actor, permission: string) { assertPermission(actor, permission); }

  function idempotent<T>(key: string, create: () => T): T {
    const previous = idempotency.get(key);

    if (previous) {
      // SAFETY: Idempotency keys are generated per command and the map is only written with that command's typed result.
      return previous as T;
    }

    const value = create();
    idempotency.set(key, value);

    return value;
  }

  function getLocation(id: string) { const location = locations.get(id); assert(location, 'NOT_FOUND', 'Stock location not found', 404);

 return location; }

  function getBalance(locationId: string, ingredientId: string, unit: string): StockBalance { const location = getLocation(locationId); const key = `${locationId}:${ingredientId}`; const balance = balances.get(key) ?? { locationId, locationLabel: location.label, locationKind: location.kind, ingredientId, quantity: 0, unit, updatedAt: new Date().toISOString() }; balances.set(key, balance);

 return balance; }

  function appendLedger(locationId: string, ingredientId: string, delta: number, unit: string, eventType: string, sourceType: string, sourceId: string) { const entry: StockLedgerEntry = { id: `ledger_${randomUUID().slice(0, 8)}`, locationId, ingredientId, quantityDelta: delta, unit, eventType, sourceType, sourceId, createdAt: new Date().toISOString() }; ledger.push(entry);

 return entry; }

  function getStaff(id: string) { const value = staff.get(id); assert(value, 'NOT_FOUND', 'Staff profile not found', 404);

 return value; }

  function getShift(id: string) { const value = shifts.get(id); assert(value, 'NOT_FOUND', 'Shift not found', 404);

 return value; }

  function getTask(id: string) { const value = tasks.get(id); assert(value, 'NOT_FOUND', 'Operational task not found', 404);

 return value; }

  function getMenuItem(id: string) { const value = menuItems.get(id); assert(value, 'NOT_FOUND', 'Menu item not found', 404);

 return value; }

  const repository: OperationsRepository = {
    async getStaffWorkspace(actor, branchId): Promise<StaffWorkspace> {
      branchCheck(actor, branchId);

      return { staff: [...staff.values()].filter((item) => item.branchId === branchId), stationAssignments: [...stationAssignments.values()].filter((item) => item.branchId === branchId), shifts: [...shifts.values()].filter((item) => item.branchId === branchId), tasks: [...tasks.values()].filter((item) => item.branchId === branchId) };
    },
    async createStaff(actor, input, requestId) {
      managerWrite(actor, 'staff:write'); branchCheck(actor, input.branchId);
      assert(input.displayName.trim().length >= 2, 'VALIDATION_ERROR', 'Staff display name is required');
      assert(input.roleCodes.length > 0 && input.roleCodes.every((role) => roles.includes(role)), 'VALIDATION_ERROR', 'At least one valid role is required');
      assert(![...staff.values()].some((item) => item.branchId === input.branchId && item.email.toLowerCase() === input.email.toLowerCase()), 'CONFLICT', 'Staff email already exists in this branch', 409);
      const profile: StaffProfile = { id: `staff_${randomUUID().slice(0, 8)}`, branchId: input.branchId, displayName: input.displayName.trim(), email: input.email.trim().toLowerCase(), status: 'ACTIVE', roleCodes: input.roleCodes, stationCodes: input.stationCodes ?? [] };
      staff.set(profile.id, profile);

      for (const assignment of input.stationAssignments ?? (input.stationCodes ?? []).map((stationCode) => ({ roleCode: input.roleCodes[0], stationCode }))) {
        assert(input.roleCodes.includes(assignment.roleCode), 'VALIDATION_ERROR', 'Station role must belong to staff');
        const id = `station_assign_${randomUUID().slice(0, 8)}`;
        stationAssignments.set(id, { id, branchId: input.branchId, staffId: profile.id, roleCode: assignment.roleCode, stationCode: assignment.stationCode, status: 'ACTIVE', effectiveFrom: new Date().toISOString() });
      }

      audit('STAFF_CREATED', 'STAFF', profile.id, actor, requestId);

 return profile;
    },
    async createShift(actor, input, requestId) {
      managerWrite(actor, 'shift:write'); branchCheck(actor, input.branchId);
      assert(new Date(input.startsAt).getTime() < new Date(input.endsAt).getTime(), 'VALIDATION_ERROR', 'Shift must end after it starts');
      assert(![...shifts.values()].some((shift) => shift.branchId === input.branchId && shift.status !== 'CANCELLED' && new Date(input.startsAt) < new Date(shift.endsAt) && new Date(input.endsAt) > new Date(shift.startsAt)), 'CONFLICT', 'Shift overlaps an existing shift', 409);
      const shift: Shift = { id: `shift_${randomUUID().slice(0, 8)}`, branchId: input.branchId, label: input.label.trim(), startsAt: input.startsAt, endsAt: input.endsAt, status: 'PLANNED', assignments: [] };
      shifts.set(shift.id, shift); audit('SHIFT_CREATED', 'SHIFT', shift.id, actor, requestId);

 return shift;
    },
    async assignShift(actor, shiftId, input, requestId) {
      managerWrite(actor, 'shift:write'); const shift = getShift(shiftId); branchCheck(actor, shift.branchId); const member = getStaff(input.staffId);
      assert(member.branchId === shift.branchId, 'OUT_OF_SCOPE', 'Staff belongs to another branch', 403); assert(member.status === 'ACTIVE', 'CONFLICT', 'Inactive staff cannot be assigned', 409); assert(member.roleCodes.includes(input.roleCode), 'VALIDATION_ERROR', 'Staff does not hold the selected role');

      if (input.stationCode) assert(member.stationCodes.includes(input.stationCode), 'VALIDATION_ERROR', 'Staff is not assigned to this station');
      assert(!shift.assignments.some((assignment) => assignment.staffId === input.staffId), 'CONFLICT', 'Staff is already assigned to this shift', 409);
      const assignment: ShiftAssignment = { id: `assignment_${randomUUID().slice(0, 8)}`, shiftId, staffId: input.staffId, roleCode: input.roleCode, stationCode: input.stationCode, status: 'ASSIGNED' };
      shift.assignments.push(assignment); audit('SHIFT_ASSIGNED', 'SHIFT_ASSIGNMENT', assignment.id, actor, requestId);

 return assignment;
    },
    async createTask(actor, input, requestId) {
      managerWrite(actor, 'task:write'); branchCheck(actor, input.branchId);

      if (input.ownerId) assert(getStaff(input.ownerId).branchId === input.branchId, 'OUT_OF_SCOPE', 'Task owner belongs to another branch', 403);
      const task: OperationalTask = { id: `task_${randomUUID().slice(0, 8)}`, branchId: input.branchId, title: input.title.trim(), sourceType: input.sourceType, sourceId: input.sourceId, priority: input.priority ?? 'NORMAL', requiredRole: input.requiredRole, stationCode: input.stationCode, ownerId: input.ownerId, dueAt: input.dueAt, status: input.ownerId ? 'CLAIMED' : 'OPEN', escalationLevel: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      tasks.set(task.id, task); audit('TASK_CREATED', 'OPERATIONAL_TASK', task.id, actor, requestId);

 return task;
    },
    async commandTask(actor, taskId, command, input, requestId) {
      managerWrite(actor, 'task:write'); const task = getTask(taskId); branchCheck(actor, task.branchId);

      if (command === 'claim') { assert(task.status === 'OPEN' || task.status === 'ESCALATED', 'CONFLICT', 'Only open or escalated tasks can be claimed', 409); task.ownerId = actor.id; task.status = 'CLAIMED'; }

      if (command === 'route') { assert(task.status !== 'RESOLVED' && task.status !== 'CANCELLED', 'CONFLICT', 'Resolved task cannot be routed', 409); task.status = 'IN_PROGRESS'; }

      if (command === 'resolve') { assert(task.status !== 'RESOLVED' && task.status !== 'CANCELLED', 'CONFLICT', 'Task is already closed', 409); const note = input.note?.trim(); assert(note, 'VALIDATION_ERROR', 'Resolution note is required'); task.status = 'RESOLVED'; task.resolutionNote = note; }

      if (command === 'handover') {
        assert(task.status !== 'RESOLVED' && task.status !== 'CANCELLED', 'CONFLICT', 'Closed task cannot be handed over', 409);
        const note = input.note?.trim(); assert(note, 'VALIDATION_ERROR', 'Handover reason is required'); assert(input.ownerId, 'VALIDATION_ERROR', 'Handover owner is required');
        const owner = getStaff(input.ownerId); assert(owner.branchId === task.branchId && owner.status === 'ACTIVE', 'CONFLICT', 'Handover owner is not active in this branch', 409);

        if (task.requiredRole) assert(owner.roleCodes.includes(task.requiredRole), 'VALIDATION_ERROR', 'Handover owner does not hold the required role');

        if (input.stationCode) assert([...stationAssignments.values()].some((assignment) => assignment.staffId === owner.id && assignment.stationCode === input.stationCode && assignment.status === 'ACTIVE'), 'VALIDATION_ERROR', 'Handover owner is not assigned to this station');
        task.ownerId = owner.id; task.stationCode = input.stationCode ?? task.stationCode; task.status = 'IN_PROGRESS'; task.resolutionNote = note;
      }

      if (command === 'escalate') { assert(task.status !== 'RESOLVED' && task.status !== 'CANCELLED', 'CONFLICT', 'Closed task cannot be escalated', 409); task.status = 'ESCALATED'; task.escalationLevel += 1; }

      task.updatedAt = new Date().toISOString(); audit(`TASK_${command.toUpperCase()}`, 'OPERATIONAL_TASK', task.id, actor, requestId);

 return task;
    },
    async getMasterData(actor, branchId): Promise<MasterDataOverview> {
      branchCheck(actor, branchId);

 return { ingredients: [...ingredients.values()], suppliers: [...suppliers.values()], categories: [...categories.values()], menuItems: [...menuItems.values()], menuVersions: [...menuVersions.values()], modifierGroups: [...modifierGroups.values()], recipes: [...recipes.values()], units: [...units.values()], allergens: [...allergens.values()] };
    },
    async createStationAssignment(actor, staffId, input: CreateStationAssignmentInput, requestId) {
      managerWrite(actor, 'shift:write'); branchCheck(actor, input.branchId); const member = getStaff(staffId);
      assert(member.branchId === input.branchId, 'OUT_OF_SCOPE', 'Staff belongs to another branch', 403); assert(member.status === 'ACTIVE', 'CONFLICT', 'Inactive staff cannot be assigned', 409); assert(member.roleCodes.includes(input.roleCode), 'VALIDATION_ERROR', 'Staff does not hold the selected role'); assert(input.stationCode.trim().length > 0, 'VALIDATION_ERROR', 'Station is required');
      assert(![...stationAssignments.values()].some((assignment) => assignment.staffId === staffId && assignment.stationCode === input.stationCode && assignment.status === 'ACTIVE'), 'CONFLICT', 'Staff already has this active station assignment', 409);
      const id = `station_assign_${randomUUID().slice(0, 8)}`; const assignment: StationAssignment = { id, branchId: input.branchId, staffId, roleCode: input.roleCode, stationCode: input.stationCode.trim(), status: 'ACTIVE', effectiveFrom: input.effectiveFrom ?? new Date().toISOString() }; stationAssignments.set(id, assignment); member.stationCodes = [...new Set([...member.stationCodes, assignment.stationCode])]; audit('STATION_ASSIGNED', 'STATION_ASSIGNMENT', id, actor, requestId);

      return assignment;
    },
    async createIngredient(actor, input, requestId) {
      managerWrite(actor, 'master-data:write'); assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Ingredient name is required'); assert(input.purchaseToStock > 0, 'VALIDATION_ERROR', 'Unit conversion must be greater than zero'); assert(input.standardCost >= 0, 'VALIDATION_ERROR', 'Standard cost cannot be negative'); const purchase = units.get(input.purchaseUnit); const stock = units.get(input.stockUnit); assert(purchase && stock && purchase.dimension === stock.dimension, 'VALIDATION_ERROR', 'Purchase and stock units must be known and share a dimension'); assert(![...ingredients.values()].some((item) => item.name.toLowerCase() === input.name.trim().toLowerCase()), 'CONFLICT', 'Ingredient already exists', 409);
      const ingredient: Ingredient = { id: `ingredient_${randomUUID().slice(0, 8)}`, name: input.name.trim(), purchaseUnit: input.purchaseUnit, stockUnit: input.stockUnit, purchaseToStock: input.purchaseToStock, standardCost: input.standardCost, status: 'ACTIVE' }; ingredients.set(ingredient.id, ingredient); audit('INGREDIENT_CREATED', 'INGREDIENT', ingredient.id, actor, requestId);

 return ingredient;
    },
    async createSupplier(actor, input, requestId) { managerWrite(actor, 'master-data:write'); const code = input.code.trim().toUpperCase(); assert(code.length >= 2 && input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Supplier code and name are required'); assert(![...suppliers.values()].some((item) => item.code === code), 'CONFLICT', 'Supplier code already exists', 409); const supplier: Supplier = { id: `supplier_${randomUUID().slice(0, 8)}`, code, name: input.name.trim(), status: 'ACTIVE' }; suppliers.set(supplier.id, supplier); audit('SUPPLIER_CREATED', 'SUPPLIER', supplier.id, actor, requestId);

 return supplier; },
    async createCategory(actor, input, requestId) { managerWrite(actor, 'master-data:write'); assert(input.name.trim().length >= 2, 'VALIDATION_ERROR', 'Category name is required'); const category: MenuCategory = { id: `category_${randomUUID().slice(0, 8)}`, name: input.name.trim(), sortOrder: input.sortOrder ?? categories.size + 1, status: 'ACTIVE' }; categories.set(category.id, category); audit('MENU_CATEGORY_CREATED', 'MENU_CATEGORY', category.id, actor, requestId);

 return category; },
    async createMenuItem(actor, input, requestId) { managerWrite(actor, 'master-data:write'); assert(categories.has(input.categoryId), 'NOT_FOUND', 'Menu category not found', 404); assert(input.name.trim().length >= 2 && input.price >= 0, 'VALIDATION_ERROR', 'Menu name and non-negative price are required'); assert((input.allergenCodes ?? []).every((code) => allergens.has(code)), 'VALIDATION_ERROR', 'Menu item contains an unknown allergen'); const item: MenuItem = { id: `item_${randomUUID().slice(0, 8)}`, categoryId: input.categoryId, name: input.name.trim(), description: input.description?.trim() ?? '', price: input.price, currency: input.currency ?? 'VND', status: 'DRAFT', allergenCodes: input.allergenCodes ?? [], stationCode: input.stationCode }; menuItems.set(item.id, item); audit('MENU_ITEM_CREATED', 'MENU_ITEM', item.id, actor, requestId);

 return item; },
    async publishMenuItem(actor, menuItemId, requestId) { managerWrite(actor, 'master-data:write'); const item = getMenuItem(menuItemId); const draft = [...menuVersions.values()].find((candidate) => candidate.menuItemId === item.id && candidate.status === 'DRAFT'); const version = draft ?? { id: `menu_version_${randomUUID().slice(0, 8)}`, menuItemId: item.id, version: [...menuVersions.values()].filter((candidate) => candidate.menuItemId === item.id).length + 1, price: item.price, effectiveFrom: new Date().toISOString(), status: 'PUBLISHED' as const };

 if (draft) draft.status = 'PUBLISHED'; menuVersions.set(version.id, version); menuVersions.forEach((candidate) => { if (candidate.menuItemId === item.id && candidate.id !== version.id && candidate.status === 'PUBLISHED') candidate.status = 'RETIRED'; }); item.price = version.price; item.status = 'PUBLISHED'; item.publishedVersionId = version.id; audit('MENU_ITEM_PUBLISHED', 'MENU_ITEM', item.id, actor, requestId);

 return item; },
    async createMenuVersion(actor, input: CreateMenuVersionInput, requestId) { managerWrite(actor, 'master-data:write'); const item = getMenuItem(input.menuItemId); assert(input.price >= 0, 'VALIDATION_ERROR', 'Menu price cannot be negative'); assert(Number.isFinite(new Date(input.effectiveFrom).getTime()), 'VALIDATION_ERROR', 'Effective time is invalid'); const version: MenuVersion = { id: `menu_version_${randomUUID().slice(0, 8)}`, menuItemId: item.id, version: [...menuVersions.values()].filter((candidate) => candidate.menuItemId === item.id).length + 1, price: input.price, effectiveFrom: input.effectiveFrom, status: 'DRAFT' }; menuVersions.set(version.id, version); audit('MENU_VERSION_CREATED', 'MENU_VERSION', version.id, actor, requestId);

 return version; },
    async createModifierGroup(actor, input: CreateModifierGroupInput, requestId) { managerWrite(actor, 'master-data:write'); getMenuItem(input.menuItemId); assert(input.name.trim().length >= 2 && input.options.length > 0, 'VALIDATION_ERROR', 'Modifier group needs a name and at least one option'); const labels = input.options.map((option) => option.label.trim().toLowerCase()); assert(new Set(labels).size === labels.length && input.options.every((option) => option.label.trim().length > 0), 'VALIDATION_ERROR', 'Modifier options must be unique and non-empty'); const group: ModifierGroup = { id: `modifier_${randomUUID().slice(0, 8)}`, menuItemId: input.menuItemId, name: input.name.trim(), required: input.required ?? false, options: input.options.map((option) => ({ id: `modifier_option_${randomUUID().slice(0, 8)}`, label: option.label.trim(), priceDelta: option.priceDelta ?? 0 })) }; modifierGroups.set(group.id, group); audit('MODIFIER_GROUP_CREATED', 'MODIFIER_GROUP', group.id, actor, requestId);

 return group; },
    async setMenuItemAllergens(actor, menuItemId, input: SetMenuItemAllergensInput, requestId) { managerWrite(actor, 'master-data:write'); const item = getMenuItem(menuItemId); assert(new Set(input.allergenCodes).size === input.allergenCodes.length && input.allergenCodes.every((code) => allergens.has(code)), 'VALIDATION_ERROR', 'Menu item contains an unknown or duplicate allergen'); item.allergenCodes = input.allergenCodes; audit('MENU_ITEM_ALLERGENS_SET', 'MENU_ITEM', item.id, actor, requestId);

 return item; },
    async setMenuItemAvailability(actor, menuItemId, input: SetMenuItemAvailabilityInput, requestId) { managerWrite(actor, 'master-data:write'); const item = getMenuItem(menuItemId); assert(input.status !== 'PUBLISHED' || item.publishedVersionId, 'CONFLICT', 'Publish a menu version before enabling this item', 409);

 if (input.status === 'INACTIVE') assert(input.reason?.trim(), 'VALIDATION_ERROR', 'Deactivation reason is required'); item.status = input.status; audit('MENU_ITEM_AVAILABILITY_SET', 'MENU_ITEM', item.id, actor, requestId);

 return item; },
    async createRecipe(actor, input, requestId) {
      managerWrite(actor, 'master-data:write');
      const item = getMenuItem(input.menuItemId);
      assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Recipe needs at least one ingredient line');

      const lines = input.lines.map((line) => {
        const ingredient = ingredients.get(line.ingredientId);
        assert(ingredient, 'NOT_FOUND', 'Recipe ingredient not found', 404);
        const source = units.get(line.unit);
        const stock = units.get(ingredient.stockUnit);
        assert(source && stock && source.dimension === stock.dimension, 'VALIDATION_ERROR', 'Recipe line unit does not match ingredient stock dimension');
        assert(line.quantity > 0, 'VALIDATION_ERROR', 'Recipe quantity must be greater than zero');

        return { ...line, canonicalQuantity: line.quantity * source.toBase / stock.toBase };
      });

      assert(item.stationCode === input.stationCode, 'VALIDATION_ERROR', 'Recipe station must match menu item station');
      const recipe: RecipeVersion = { id: `recipe_${randomUUID().slice(0, 8)}`, menuItemId: input.menuItemId, version: [...recipes.values()].filter((candidate) => candidate.menuItemId === input.menuItemId).length + 1, status: 'DRAFT', stationCode: input.stationCode, lines };
      recipes.set(recipe.id, recipe);
      audit('RECIPE_CREATED', 'RECIPE_VERSION', recipe.id, actor, requestId);

      return recipe;
    },
    async publishRecipe(actor, recipeId, requestId) { managerWrite(actor, 'master-data:write'); const recipe = recipes.get(recipeId); assert(recipe, 'NOT_FOUND', 'Recipe not found', 404); assert(recipe.lines.length > 0, 'VALIDATION_ERROR', 'Recipe needs at least one ingredient line'); recipes.forEach((candidate) => { if (candidate.menuItemId === recipe.menuItemId && candidate.status === 'PUBLISHED') candidate.status = 'RETIRED'; }); recipe.status = 'PUBLISHED'; recipe.publishedAt = new Date().toISOString(); audit('RECIPE_PUBLISHED', 'RECIPE_VERSION', recipe.id, actor, requestId);

 return recipe; },
    async getBohWorkspace(actor, branchId): Promise<BohWorkspace> {
      branchCheck(actor, branchId);

      return { purchaseOrders: [...purchaseOrders.values()].filter((po) => po.branchId === branchId), receipts: [...receipts.values()].filter((receipt) => receipt.branchId === branchId), stockBalances: [...balances.values()], stockRequests: [...stockRequests.values()], dailyCounts: [...dailyCounts.values()].filter((count) => count.branchId === branchId), wastage: [...wastage.values()].filter((item) => item.branchId === branchId), ledger: [...ledger] };
    },
    async createPurchaseOrder(actor, input: CreatePurchaseOrderInput, requestId, idempotencyKey) {
      managerWrite(actor, 'master-data:write'); branchCheck(actor, input.branchId); assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Purchase order needs at least one line');

      return idempotent(idempotencyKey, () => { assert(suppliers.has(input.supplierId), 'NOT_FOUND', 'Supplier not found', 404); const seen = new Set<string>();

 const lines = input.lines.map((line) => { assert(!seen.has(line.ingredientId), 'VALIDATION_ERROR', 'Purchase order cannot repeat an ingredient'); seen.add(line.ingredientId); assert(ingredients.has(line.ingredientId) && units.has(line.unit), 'VALIDATION_ERROR', 'Purchase order ingredient or unit is unknown'); assert(line.orderedQuantity > 0, 'VALIDATION_ERROR', 'Ordered quantity must be greater than zero');

 return { id: `po_line_${randomUUID().slice(0, 8)}`, ingredientId: line.ingredientId, orderedQuantity: line.orderedQuantity, receivedQuantity: 0, unit: line.unit }; });

 const po: PurchaseOrder = { id: `po_${randomUUID().slice(0, 8)}`, branchId: input.branchId, supplierId: input.supplierId, status: 'DRAFT', lines, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; purchaseOrders.set(po.id, po); audit('PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER', po.id, actor, requestId);

 return po; });
    },
    async commandPurchaseOrder(actor, purchaseOrderId, command, requestId, idempotencyKey) {
      managerWrite(actor, 'master-data:write');

 return idempotent(idempotencyKey, () => { const po = purchaseOrders.get(purchaseOrderId); assert(po, 'NOT_FOUND', 'Purchase order not found', 404); branchCheck(actor, po.branchId);

 if (command === 'send') { assert(po.status === 'DRAFT', 'CONFLICT', 'Only draft purchase orders can be sent', 409); po.status = 'SENT'; } else { assert(po.status === 'DRAFT' || po.status === 'SENT', 'CONFLICT', 'Purchase order cannot be cancelled in this state', 409); po.status = 'CANCELLED'; }

 po.updatedAt = new Date().toISOString(); audit(`PURCHASE_ORDER_${command.toUpperCase()}`, 'PURCHASE_ORDER', po.id, actor, requestId);

 return po; });
    },
    async confirmGoodsReceipt(actor, input, requestId, idempotencyKey) {
      managerWrite(actor, 'master-data:write'); branchCheck(actor, input.branchId); assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Receipt needs at least one line');

      return idempotent(idempotencyKey, () => { const po = purchaseOrders.get(input.purchaseOrderId); assert(po && po.branchId === input.branchId, 'NOT_FOUND', 'Purchase order not found', 404); assert(po.status !== 'CANCELLED' && po.status !== 'RECEIVED', 'CONFLICT', 'Purchase order cannot receive more goods', 409);

 const receiptLines = input.lines.map((line) => { const orderLine = po.lines.find((candidate) => candidate.ingredientId === line.ingredientId); assert(orderLine, 'VALIDATION_ERROR', 'Receipt line is not on the purchase order'); const total = line.acceptedQuantity + line.damagedQuantity + line.rejectedQuantity; assert(total > 0 && line.acceptedQuantity >= 0 && line.damagedQuantity >= 0 && line.rejectedQuantity >= 0, 'VALIDATION_ERROR', 'Receipt quantities are invalid'); assert(orderLine.receivedQuantity + total <= orderLine.orderedQuantity, 'CONFLICT', 'Receipt exceeds ordered quantity', 409);

 return line; });

 const receipt: GoodsReceipt = { id: `receipt_${randomUUID().slice(0, 8)}`, branchId: input.branchId, purchaseOrderId: po.id, status: 'CONFIRMED', lines: receiptLines, confirmedAt: new Date().toISOString(), createdAt: new Date().toISOString() }; receipts.set(receipt.id, receipt); const warehouse = getLocation('location_warehouse');

 for (const line of receiptLines) { const orderLine = po.lines.find((candidate) => candidate.ingredientId === line.ingredientId);

 if (!orderLine) continue; orderLine.receivedQuantity += line.acceptedQuantity + line.damagedQuantity + line.rejectedQuantity;

 if (line.acceptedQuantity > 0) { const balance = getBalance(warehouse.id, line.ingredientId, line.unit); balance.quantity += line.acceptedQuantity; balance.updatedAt = new Date().toISOString(); appendLedger(warehouse.id, line.ingredientId, line.acceptedQuantity, line.unit, 'GOODS_RECEIPT_CONFIRMED', 'GOODS_RECEIPT', receipt.id); } }

 po.status = po.lines.every((line) => line.receivedQuantity >= line.orderedQuantity) ? 'RECEIVED' : 'PARTIALLY_RECEIVED'; po.updatedAt = new Date().toISOString(); audit('GOODS_RECEIPT_CONFIRMED', 'GOODS_RECEIPT', receipt.id, actor, requestId);

 return receipt; });
    },
    async createStockRequest(actor, input: CreateStockRequestInput, requestId, idempotencyKey) {
      managerWrite(actor, 'master-data:write'); const from = getLocation(input.fromLocationId); const to = getLocation(input.toLocationId); assert(to.branchId, 'VALIDATION_ERROR', 'Destination must be a branch location'); branchCheck(actor, to.branchId); assert(input.lines.length > 0 && input.reason.trim().length >= 3, 'VALIDATION_ERROR', 'Stock request needs a reason and line'); assert(from.id !== to.id, 'VALIDATION_ERROR', 'Stock request locations must differ');

      return idempotent(idempotencyKey, () => { const lines = input.lines.map((line) => { assert(ingredients.has(line.ingredientId) && units.has(line.unit), 'VALIDATION_ERROR', 'Stock request ingredient or unit is unknown'); assert(line.requestedQuantity > 0, 'VALIDATION_ERROR', 'Requested quantity must be greater than zero');

 return { ingredientId: line.ingredientId, requestedQuantity: line.requestedQuantity, unit: line.unit }; });

 const request: StockRequest = { id: `request_${randomUUID().slice(0, 8)}`, fromLocationId: from.id, toLocationId: to.id, status: 'REQUESTED', lines, reason: input.reason.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; stockRequests.set(request.id, request); audit('STOCK_REQUEST_CREATED', 'STOCK_REQUEST', request.id, actor, requestId);

 return request; });
    },
    async commandStockRequest(actor, requestIdId, command, input) {
      managerWrite(actor, 'master-data:write');

      return idempotent(input.idempotencyKey, () => { const request = stockRequests.get(requestIdId); assert(request, 'NOT_FOUND', 'Stock request not found', 404); const from = getLocation(request.fromLocationId); const to = getLocation(request.toLocationId); assert(to.branchId, 'VALIDATION_ERROR', 'Destination must be a branch location'); branchCheck(actor, to.branchId);

 if (command === 'approve') { assert(request.status === 'REQUESTED', 'CONFLICT', 'Only requested stock transfers can be approved', 409); request.status = 'APPROVED'; request.lines = request.lines.map((line) => ({ ...line, approvedQuantity: line.requestedQuantity })); }

 if (command === 'reject') { assert(request.status === 'REQUESTED', 'CONFLICT', 'Only requested stock transfers can be rejected', 409); assert(input.reason?.trim(), 'VALIDATION_ERROR', 'Rejection reason is required'); request.status = 'REJECTED'; }

 if (command === 'ship') { assert(request.status === 'APPROVED', 'CONFLICT', 'Only approved stock transfers can ship', 409);

 for (const line of request.lines) { const quantity = line.approvedQuantity ?? line.requestedQuantity; const balance = getBalance(from.id, line.ingredientId, line.unit); assert(balance.quantity >= quantity, 'CONFLICT', 'Insufficient available stock', 409); balance.quantity -= quantity; balance.updatedAt = new Date().toISOString(); appendLedger(from.id, line.ingredientId, -quantity, line.unit, 'STOCK_SHIPPED', 'STOCK_REQUEST', request.id); }

 request.lines = request.lines.map((line) => ({ ...line, shippedQuantity: line.approvedQuantity ?? line.requestedQuantity })); request.status = 'IN_TRANSIT'; }

 if (command === 'accept') { assert(request.status === 'IN_TRANSIT', 'CONFLICT', 'Only in-transit stock transfers can be accepted', 409);

 for (const line of request.lines) { const quantity = line.shippedQuantity ?? 0; const balance = getBalance(to.id, line.ingredientId, line.unit); balance.quantity += quantity; balance.updatedAt = new Date().toISOString(); appendLedger(to.id, line.ingredientId, quantity, line.unit, 'STOCK_RECEIVED', 'STOCK_REQUEST', request.id); }

 request.lines = request.lines.map((line) => ({ ...line, receivedQuantity: line.shippedQuantity ?? 0 })); request.status = 'CLOSED'; }

 request.updatedAt = new Date().toISOString(); audit(`STOCK_REQUEST_${command.toUpperCase()}`, 'STOCK_REQUEST', request.id, actor, requestIdId);

 return request; });
    },
    async createDailyCount(actor, input: CreateDailyCountInput, requestId, idempotencyKey) {
      managerWrite(actor, 'master-data:write'); branchCheck(actor, input.branchId); assert(input.lines.length > 0, 'VALIDATION_ERROR', 'Daily count needs at least one line');

      return idempotent(idempotencyKey, () => { const lines = input.lines.map((line) => { const theoreticalSoldStatus: DailyCount['lines'][number]['theoreticalSoldStatus'] = line.theoreticalSoldQuantity === undefined ? 'INCOMPLETE_THEORY' : 'AVAILABLE'; const theoretical = line.theoreticalSoldQuantity ?? 0;

 return { ...line, varianceQuantity: theoreticalSoldStatus === 'AVAILABLE' ? line.closingQuantity - (line.openingQuantity + line.receivedQuantity - theoretical) : 0, theoreticalSoldStatus }; });

 const count: DailyCount = { id: `count_${randomUUID().slice(0, 8)}`, branchId: input.branchId, businessDate: input.businessDate, status: 'DRAFT', lines, createdAt: new Date().toISOString() }; dailyCounts.set(count.id, count); audit('DAILY_COUNT_CREATED', 'DAILY_COUNT', count.id, actor, requestId);

 return count; });
    },
    async submitDailyCount(actor, countId, requestId, idempotencyKey) { managerWrite(actor, 'master-data:write');

 return idempotent(idempotencyKey, () => { const count = dailyCounts.get(countId); assert(count, 'NOT_FOUND', 'Daily count not found', 404); branchCheck(actor, count.branchId); assert(count.status === 'DRAFT' || count.status === 'REJECTED', 'CONFLICT', 'Daily count cannot be submitted in this state', 409); count.status = 'SUBMITTED'; count.submittedAt = new Date().toISOString(); audit('DAILY_COUNT_SUBMITTED', 'DAILY_COUNT', count.id, actor, requestId);

 return count; }); },
    async createWastage(actor, input: CreateWastageInput, requestId, idempotencyKey) { managerWrite(actor, 'master-data:write'); branchCheck(actor, input.branchId); const ingredient = ingredients.get(input.ingredientId); assert(ingredient, 'NOT_FOUND', 'Ingredient not found', 404); assert(input.quantity > 0 && input.reason.trim().length >= 3, 'VALIDATION_ERROR', 'Wastage quantity and reason are required');

 return idempotent(idempotencyKey, () => { const record: WastageRecord = { id: `wastage_${randomUUID().slice(0, 8)}`, branchId: input.branchId, ingredientId: input.ingredientId, quantity: input.quantity, unit: input.unit, reason: input.reason.trim(), standardPrice: ingredient.standardCost, value: input.quantity * ingredient.standardCost, status: 'DRAFT', note: input.note?.trim(), createdAt: new Date().toISOString() }; wastage.set(record.id, record); audit('WASTAGE_CREATED', 'WASTAGE', record.id, actor, requestId);

 return record; }); },
    async submitWastage(actor, wastageId, requestId, idempotencyKey) { managerWrite(actor, 'master-data:write');

 return idempotent(idempotencyKey, () => { const record = wastage.get(wastageId); assert(record, 'NOT_FOUND', 'Wastage record not found', 404); branchCheck(actor, record.branchId); assert(record.status === 'DRAFT' || record.status === 'REJECTED', 'CONFLICT', 'Wastage cannot be submitted in this state', 409); record.status = 'SUBMITTED'; audit('WASTAGE_SUBMITTED', 'WASTAGE', record.id, actor, requestId);

 return record; }); }
  };

  return repository;
}
