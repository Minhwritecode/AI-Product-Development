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
  Supplier
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

  const auditEvents: AuditEvent[] = [];

  function audit(action: string, entityType: string, entityId: string, actor: Actor, requestId: string) {
    auditEvents.push({ action, entityType, entityId, actorId: actor.id, requestId });
  }

  function branchCheck(actor: Actor, branchId: string) { assertBranchScope(actor, branchId); }

  function managerWrite(actor: Actor, permission: string) { assertPermission(actor, permission); }

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

 return recipe; }
  };

  return repository;
}
