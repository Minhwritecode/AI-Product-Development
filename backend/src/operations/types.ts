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

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export type GoodsReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export type StockRequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'RECEIVED' | 'CLOSED';

export type CountStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';

export type WastageStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';

export type PurchaseOrderLine = { id: string; ingredientId: string; orderedQuantity: number; receivedQuantity: number; unit: string };

export type PurchaseOrder = { id: string; branchId: string; supplierId: string; status: PurchaseOrderStatus; lines: PurchaseOrderLine[]; createdAt: string; updatedAt: string };

export type GoodsReceiptLine = { ingredientId: string; acceptedQuantity: number; damagedQuantity: number; rejectedQuantity: number; unit: string; note?: string };

export type GoodsReceipt = { id: string; branchId: string; purchaseOrderId: string; status: GoodsReceiptStatus; lines: GoodsReceiptLine[]; confirmedAt?: string; createdAt: string };

export type StockBalance = { locationId: string; locationLabel: string; locationKind: 'WAREHOUSE' | 'BRANCH'; ingredientId: string; quantity: number; unit: string; updatedAt: string };

export type StockLedgerEntry = { id: string; locationId: string; ingredientId: string; quantityDelta: number; unit: string; eventType: string; sourceType: string; sourceId: string; createdAt: string };

export type StockRequestLine = { ingredientId: string; requestedQuantity: number; approvedQuantity?: number; shippedQuantity?: number; receivedQuantity?: number; unit: string };

export type StockRequest = { id: string; fromLocationId: string; toLocationId: string; status: StockRequestStatus; lines: StockRequestLine[]; reason: string; createdAt: string; updatedAt: string };

export type DailyCountLine = { ingredientId: string; openingQuantity: number; receivedQuantity: number; theoreticalSoldQuantity?: number; theoreticalSoldStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'INCOMPLETE_THEORY'; closingQuantity: number; varianceQuantity: number; unit: string };

export type DailyCount = { id: string; branchId: string; businessDate: string; status: CountStatus; lines: DailyCountLine[]; submittedAt?: string; createdAt: string };

export type WastageRecord = { id: string; branchId: string; ingredientId: string; quantity: number; unit: string; reason: string; standardPrice: number; value: number; status: WastageStatus; note?: string; createdAt: string };

export type BohWorkspace = { purchaseOrders: PurchaseOrder[]; receipts: GoodsReceipt[]; stockBalances: StockBalance[]; stockRequests: StockRequest[]; dailyCounts: DailyCount[]; wastage: WastageRecord[]; ledger: StockLedgerEntry[] };

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

export type CreatePurchaseOrderInput = { branchId: string; supplierId: string; lines: Array<{ ingredientId: string; orderedQuantity: number; unit: string }> };

export type ConfirmGoodsReceiptInput = { branchId: string; purchaseOrderId: string; lines: GoodsReceiptLine[] };

export type CreateStockRequestInput = { fromLocationId: string; toLocationId: string; reason: string; lines: Array<{ ingredientId: string; requestedQuantity: number; unit: string }> };

export type CreateDailyCountInput = { branchId: string; businessDate: string; lines: Array<Omit<DailyCountLine, 'varianceQuantity' | 'theoreticalSoldStatus'> & { theoreticalSoldQuantity?: number }> };

export type CreateWastageInput = { branchId: string; ingredientId: string; quantity: number; unit: string; reason: string; note?: string };

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
  getBohWorkspace(actor: Actor, branchId: string): Promise<BohWorkspace>;
  createPurchaseOrder(actor: Actor, input: CreatePurchaseOrderInput, requestId: string, idempotencyKey: string): Promise<PurchaseOrder>;
  commandPurchaseOrder(actor: Actor, purchaseOrderId: string, command: 'send' | 'cancel', requestId: string, idempotencyKey: string): Promise<PurchaseOrder>;
  confirmGoodsReceipt(actor: Actor, input: ConfirmGoodsReceiptInput, requestId: string, idempotencyKey: string): Promise<GoodsReceipt>;
  createStockRequest(actor: Actor, input: CreateStockRequestInput, requestId: string, idempotencyKey: string): Promise<StockRequest>;
  commandStockRequest(actor: Actor, requestIdId: string, command: 'approve' | 'reject' | 'ship' | 'accept', input: { reason: string; idempotencyKey: string }): Promise<StockRequest>;
  createDailyCount(actor: Actor, input: CreateDailyCountInput, requestId: string, idempotencyKey: string): Promise<DailyCount>;
  submitDailyCount(actor: Actor, countId: string, requestId: string, idempotencyKey: string): Promise<DailyCount>;
  createWastage(actor: Actor, input: CreateWastageInput, requestId: string, idempotencyKey: string): Promise<WastageRecord>;
  submitWastage(actor: Actor, wastageId: string, requestId: string, idempotencyKey: string): Promise<WastageRecord>;
};
