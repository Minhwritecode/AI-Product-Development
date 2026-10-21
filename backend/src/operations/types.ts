import type { Actor, RoleCode } from '../platform/types.js';

export type StaffStatus = 'ACTIVE' | 'INACTIVE';

export type ShiftStatus = 'PLANNED' | 'OPEN' | 'CLOSED' | 'CANCELLED';

export type AssignmentStatus = 'ASSIGNED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';

export type TaskStatus = 'OPEN' | 'CLAIMED' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type MasterStatus = 'ACTIVE' | 'INACTIVE';

export type MenuItemStatus = 'DRAFT' | 'PUBLISHED' | 'UNAVAILABLE' | 'INACTIVE';

export type VersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export type StaffProfile = {
  id: string;
  branchId: string;
  displayName: string;
  email: string;
  status: StaffStatus;
  roleCodes: RoleCode[];
  stationCodes: string[];
};

export type StationAssignmentStatus = 'ACTIVE' | 'INACTIVE';

export type StationAssignment = {
  id: string;
  branchId: string;
  staffId: string;
  roleCode: RoleCode;
  stationCode: string;
  status: StationAssignmentStatus;
  effectiveFrom: string;
  effectiveTo?: string;
};

export type Shift = {
  id: string;
  branchId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  assignments: ShiftAssignment[];
};

export type ShiftAssignment = {
  id: string;
  shiftId: string;
  staffId: string;
  roleCode: RoleCode;
  stationCode?: string;
  status: AssignmentStatus;
};

export type OperationalTask = {
  id: string;
  branchId: string;
  title: string;
  sourceType: 'SHIFT' | 'QR_REQUEST' | 'QUEUE' | 'EXCEPTION' | 'MANUAL';
  sourceId?: string;
  priority: TaskPriority;
  requiredRole?: RoleCode;
  stationCode?: string;
  ownerId?: string;
  dueAt?: string;
  status: TaskStatus;
  resolutionNote?: string;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
};

export type StaffWorkspace = {
  staff: StaffProfile[];
  stationAssignments: StationAssignment[];
  shifts: Shift[];
  tasks: OperationalTask[];
};

export type UnitDefinition = { code: string; dimension: 'MASS' | 'VOLUME' | 'COUNT'; toBase: number; status: MasterStatus };

export type Allergen = { code: string; label: string; status: MasterStatus };

export type Ingredient = {
  id: string;
  name: string;
  purchaseUnit: string;
  stockUnit: string;
  purchaseToStock: number;
  standardCost: number;
  status: MasterStatus;
};

export type Supplier = { id: string; code: string; name: string; status: MasterStatus };

export type MenuCategory = { id: string; name: string; sortOrder: number; status: MasterStatus };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  status: MenuItemStatus;
  allergenCodes: string[];
  stationCode: 'KITCHEN' | 'BAR';
  publishedVersionId?: string;
};

export type MenuVersion = { id: string; menuItemId: string; version: number; price: number; effectiveFrom: string; status: VersionStatus };

export type ModifierOption = { id: string; label: string; priceDelta: number };

export type ModifierGroup = { id: string; menuItemId: string; name: string; required: boolean; options: ModifierOption[] };

export type RecipeLine = { ingredientId: string; quantity: number; unit: string; canonicalQuantity?: number };

export type RecipeVersion = { id: string; menuItemId: string; version: number; status: VersionStatus; stationCode: 'KITCHEN' | 'BAR'; lines: RecipeLine[]; publishedAt?: string };

export type MasterDataOverview = { ingredients: Ingredient[]; suppliers: Supplier[]; categories: MenuCategory[]; menuItems: MenuItem[]; menuVersions: MenuVersion[]; modifierGroups: ModifierGroup[]; recipes: RecipeVersion[]; units: UnitDefinition[]; allergens: Allergen[] };

export type CreateStaffInput = { branchId: string; displayName: string; email: string; roleCodes: RoleCode[]; stationCodes?: string[]; stationAssignments?: Array<{ roleCode: RoleCode; stationCode: string }> };

export type CreateShiftInput = { branchId: string; label: string; startsAt: string; endsAt: string };

export type CreateAssignmentInput = { staffId: string; roleCode: RoleCode; stationCode?: string };

export type CreateStationAssignmentInput = { branchId: string; roleCode: RoleCode; stationCode: string; effectiveFrom?: string };

export type CreateTaskInput = { branchId: string; title: string; sourceType: OperationalTask['sourceType']; sourceId?: string; priority?: TaskPriority; requiredRole?: RoleCode; stationCode?: string; ownerId?: string; dueAt?: string };

export type TaskCommandInput = { note?: string; ownerId?: string; stationCode?: string };

export type CreateIngredientInput = { name: string; purchaseUnit: string; stockUnit: string; purchaseToStock: number; standardCost: number };

export type CreateSupplierInput = { code: string; name: string };

export type CreateCategoryInput = { name: string; sortOrder?: number };

export type CreateMenuItemInput = { categoryId: string; name: string; description?: string; price: number; currency?: string; allergenCodes?: string[]; stationCode: MenuItem['stationCode'] };

export type CreateRecipeInput = { menuItemId: string; stationCode: RecipeVersion['stationCode']; lines: RecipeLine[] };

export type CreateMenuVersionInput = { menuItemId: string; price: number; effectiveFrom: string };

export type CreateModifierGroupInput = { menuItemId: string; name: string; required?: boolean; options: Array<{ label: string; priceDelta?: number }> };

export type SetMenuItemAllergensInput = { allergenCodes: string[] };

export type SetMenuItemAvailabilityInput = { status: Extract<MenuItemStatus, 'PUBLISHED' | 'UNAVAILABLE' | 'INACTIVE'>; reason?: string };

export type OperationsRepository = {
  getStaffWorkspace(actor: Actor, branchId: string): Promise<StaffWorkspace>;
  createStaff(actor: Actor, input: CreateStaffInput, requestId: string): Promise<StaffProfile>;
  createShift(actor: Actor, input: CreateShiftInput, requestId: string): Promise<Shift>;
  assignShift(actor: Actor, shiftId: string, input: CreateAssignmentInput, requestId: string): Promise<ShiftAssignment>;
  createTask(actor: Actor, input: CreateTaskInput, requestId: string): Promise<OperationalTask>;
  commandTask(actor: Actor, taskId: string, command: 'claim' | 'route' | 'resolve' | 'escalate' | 'handover', input: TaskCommandInput, requestId: string): Promise<OperationalTask>;
  createStationAssignment(actor: Actor, staffId: string, input: CreateStationAssignmentInput, requestId: string): Promise<StationAssignment>;
  getMasterData(actor: Actor, branchId: string): Promise<MasterDataOverview>;
  createIngredient(actor: Actor, input: CreateIngredientInput, requestId: string): Promise<Ingredient>;
  createSupplier(actor: Actor, input: CreateSupplierInput, requestId: string): Promise<Supplier>;
  createCategory(actor: Actor, input: CreateCategoryInput, requestId: string): Promise<MenuCategory>;
  createMenuItem(actor: Actor, input: CreateMenuItemInput, requestId: string): Promise<MenuItem>;
  publishMenuItem(actor: Actor, menuItemId: string, requestId: string): Promise<MenuItem>;
  createMenuVersion(actor: Actor, input: CreateMenuVersionInput, requestId: string): Promise<MenuVersion>;
  createModifierGroup(actor: Actor, input: CreateModifierGroupInput, requestId: string): Promise<ModifierGroup>;
  setMenuItemAllergens(actor: Actor, menuItemId: string, input: SetMenuItemAllergensInput, requestId: string): Promise<MenuItem>;
  setMenuItemAvailability(actor: Actor, menuItemId: string, input: SetMenuItemAvailabilityInput, requestId: string): Promise<MenuItem>;
  createRecipe(actor: Actor, input: CreateRecipeInput, requestId: string): Promise<RecipeVersion>;
  publishRecipe(actor: Actor, recipeId: string, requestId: string): Promise<RecipeVersion>;
};
