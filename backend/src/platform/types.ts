export type RoleCode = 'OWNER' | 'ADMIN' | 'MANAGER' | 'HOST' | 'SERVER' | 'KITCHEN' | 'BAR' | 'CASHIER';

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  permissions: string[];
  branchIds: string[];
  restaurantIds: string[];
};

export type AuthenticatedUser = Actor & { sessionId: string };

export type Restaurant = {
  id: string;
  name: string;
  defaultCurrency: string;
  defaultLocale: string;
  status: 'ACTIVE' | 'INACTIVE';
};

export type Branch = {
  id: string;
  restaurantId: string;
  name: string;
  code: string;
  timezone: string;
  currency: string;
  locale: string;
  serviceHours: Record<string, { open: string; close: string }>;
  status: 'ACTIVE' | 'INACTIVE';
};

export type Area = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
};

export type RestaurantTable = {
  id: string;
  areaId: string;
  label: string;
  capacity: number;
  accessibilityTags: string[];
  status: 'READY' | 'BLOCKED' | 'MAINTENANCE' | 'INACTIVE';
};

export type SetupOverview = {
  restaurant: Restaurant;
  branches: Array<Branch & { areas: Array<Area & { tables: RestaurantTable[] }> }>;
};

export type PlatformRepository = {
  authenticate(email: string, password: string): Promise<Actor | null>;
  findActor(userId: string): Promise<Actor | null>;
  isSessionRevoked(sessionId: string): Promise<boolean>;
  revokeSession(sessionId: string, actor: Actor, requestId: string): Promise<void>;
  getSetupOverview(actor: Actor): Promise<SetupOverview>;
  getBranchSetup(actor: Actor, branchId: string): Promise<SetupOverview['branches'][number]>;
  createRestaurant(actor: Actor, input: CreateRestaurantInput, requestId: string): Promise<Restaurant>;
  createBranch(actor: Actor, restaurantId: string, input: CreateBranchInput, requestId: string): Promise<Branch>;
  updateBranch(actor: Actor, branchId: string, input: UpdateBranchInput, requestId: string): Promise<Branch>;
  createArea(actor: Actor, branchId: string, input: CreateAreaInput, requestId: string): Promise<Area>;
  createTable(actor: Actor, areaId: string, input: CreateTableInput, requestId: string): Promise<RestaurantTable>;
};

export type CreateRestaurantInput = {
  name: string;
  defaultCurrency?: string;
  defaultLocale?: string;
};

export type CreateBranchInput = {
  name: string;
  code: string;
  timezone?: string;
  currency?: string;
  locale?: string;
  serviceHours?: Branch['serviceHours'];
};

export type UpdateBranchInput = Partial<Omit<CreateBranchInput, 'code'>> & { status?: Branch['status'] };

export type CreateAreaInput = { name: string; sortOrder?: number };

export type CreateTableInput = {
  label: string;
  capacity: number;
  accessibilityTags?: string[];
};
