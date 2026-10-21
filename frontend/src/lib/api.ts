export type ApiError = { code: string; message: string; fields?: Record<string, string | number | boolean | null> };

export type ApiEnvelope<T> = {
  data: T | null;
  meta: { requestId: string };
  error: ApiError | null;
};

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
  areas: Area[];
};

export type Area = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  tables: RestaurantTable[];
};

export type RestaurantTable = {
  id: string;
  areaId: string;
  label: string;
  capacity: number;
  accessibilityTags: string[];
  status: 'READY' | 'BLOCKED' | 'MAINTENANCE' | 'INACTIVE';
};

export type SetupOverview = { restaurant: Restaurant; branches: Branch[] };

export type SessionUser = { id: string; email: string; displayName: string; roles: string[]; branchIds: string[] };

export type LoginData = { token: string; user: SessionUser };

export type StaffProfile = { id: string; branchId: string; displayName: string; email: string; status: 'ACTIVE' | 'INACTIVE'; roleCodes: string[]; stationCodes: string[] };

export type StationAssignment = { id: string; branchId: string; staffId: string; roleCode: string; stationCode: string; status: 'ACTIVE' | 'INACTIVE'; effectiveFrom: string; effectiveTo?: string };

export type OperationalTask = { id: string; branchId: string; title: string; sourceType: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; requiredRole?: string; stationCode?: string; ownerId?: string; dueAt?: string; status: 'OPEN' | 'CLAIMED' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CANCELLED'; resolutionNote?: string; escalationLevel: number; createdAt: string; updatedAt: string };

export type Shift = { id: string; branchId: string; label: string; startsAt: string; endsAt: string; status: string; assignments: { id: string; staffId: string; roleCode: string; stationCode?: string; status: string }[] };

export type StaffWorkspace = { staff: StaffProfile[]; stationAssignments: StationAssignment[]; shifts: Shift[]; tasks: OperationalTask[] };

export type Ingredient = { id: string; name: string; purchaseUnit: string; stockUnit: string; purchaseToStock: number; standardCost: number; status: string };

export type MenuCategory = { id: string; name: string; sortOrder: number; status: string };

export type MenuItem = { id: string; categoryId: string; name: string; description: string; price: number; currency: string; status: 'DRAFT' | 'PUBLISHED' | 'UNAVAILABLE' | 'INACTIVE'; allergenCodes: string[]; stationCode: 'KITCHEN' | 'BAR'; publishedVersionId?: string };

export type RecipeVersion = { id: string; menuItemId: string; version: number; status: string; stationCode: 'KITCHEN' | 'BAR'; lines: { ingredientId: string; quantity: number; unit: string; canonicalQuantity?: number }[]; publishedAt?: string };

export type UnitDefinition = { code: string; dimension: string; toBase: number; status: string };

export type Allergen = { code: string; label: string; status: string };

export type MasterDataOverview = { ingredients: Ingredient[]; suppliers: { id: string; code: string; name: string; status: string }[]; categories: MenuCategory[]; menuItems: MenuItem[]; menuVersions: { id: string; menuItemId: string; version: number; price: number; effectiveFrom: string; status: string }[]; modifierGroups: { id: string; menuItemId: string; name: string; required: boolean; options: { id: string; label: string; priceDelta: number }[] }[]; recipes: RecipeVersion[]; units: UnitDefinition[]; allergens: Allergen[] };

export function createApiClient(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${root}${path}`, {
      ...options,
      headers
    });

    // SAFETY: The backend contract always returns an ApiEnvelope JSON response, including errors.
    const envelope = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || envelope.error) {
      throw new Error(envelope.error?.message ?? `Request failed with status ${response.status}`);
    }

    if (envelope.data === null) throw new Error('The API returned no data');

    return envelope.data;
  }

  return {
    login: (email: string, password: string) => request<LoginData>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: (token: string) => request<{ revoked: boolean }>('/v1/auth/logout', { method: 'POST' }, token),
    overview: (token: string) => request<SetupOverview>('/v1/setup/overview', {}, token),
    operationsWorkspace: (token: string, branchId: string) => request<StaffWorkspace>(`/v1/operations/workspace?branchId=${encodeURIComponent(branchId)}`, {}, token),
    masterData: (token: string, branchId: string) => request<MasterDataOverview>(`/v1/master-data/overview?branchId=${encodeURIComponent(branchId)}`, {}, token),
    createTask: (token: string, input: { branchId: string; title: string; sourceType: string; priority?: string }) => request<OperationalTask>('/v1/operational-tasks', { method: 'POST', body: JSON.stringify(input) }, token),
    createStaff: (token: string, input: { branchId: string; displayName: string; email: string; roleCodes: string[]; stationAssignments?: { roleCode: string; stationCode: string }[] }) => request<StaffProfile>('/v1/staff', { method: 'POST', body: JSON.stringify(input) }, token),
    createShift: (token: string, input: { branchId: string; label: string; startsAt: string; endsAt: string }) => request<Shift>(`/v1/shifts`, { method: 'POST', body: JSON.stringify(input) }, token),
    assignShift: (token: string, shiftId: string, input: { staffId: string; roleCode: string; stationCode?: string }) => request<Shift['assignments'][number]>(`/v1/shifts/${shiftId}/assignments`, { method: 'POST', body: JSON.stringify(input) }, token),
    createArea: (token: string, branchId: string, input: { name: string; sortOrder?: number }) => request<Area>(`/v1/branches/${branchId}/areas`, { method: 'POST', body: JSON.stringify(input) }, token),
    createTable: (token: string, areaId: string, input: { label: string; capacity: number; accessibilityTags?: string[] }) => request<RestaurantTable>(`/v1/areas/${areaId}/tables`, { method: 'POST', body: JSON.stringify(input) }, token),
    commandTask: (token: string, taskId: string, command: 'claim' | 'route' | 'resolve' | 'escalate' | 'handover', body: { note?: string; ownerId?: string; stationCode?: string } = {}) => request<OperationalTask>(`/v1/operational-tasks/${taskId}/${command}`, { method: 'POST', body: JSON.stringify(body) }, token),
    createIngredient: (token: string, input: Omit<Ingredient, 'id' | 'status'>) => request<Ingredient>('/v1/ingredients', { method: 'POST', body: JSON.stringify(input) }, token),
    createMenuItem: (token: string, input: { categoryId: string; name: string; description?: string; price: number; currency?: string; allergenCodes?: string[]; stationCode: 'KITCHEN' | 'BAR' }) => request<MenuItem>('/v1/menu/items', { method: 'POST', body: JSON.stringify(input) }, token),
    publishMenuItem: (token: string, menuItemId: string) => request<MenuItem>(`/v1/menu/items/${menuItemId}/publish`, { method: 'POST' }, token),
    createMenuVersion: (token: string, input: { menuItemId: string; price: number; effectiveFrom: string }) => request<MasterDataOverview['menuVersions'][number]>('/v1/menu/versions', { method: 'POST', body: JSON.stringify(input) }, token),
    createModifierGroup: (token: string, input: { menuItemId: string; name: string; required?: boolean; options: { label: string; priceDelta?: number }[] }) => request<MasterDataOverview['modifierGroups'][number]>('/v1/menu/modifier-groups', { method: 'POST', body: JSON.stringify(input) }, token),
    setMenuItemAllergens: (token: string, menuItemId: string, allergenCodes: string[]) => request<MenuItem>(`/v1/menu/items/${menuItemId}/allergens`, { method: 'POST', body: JSON.stringify({ allergenCodes }) }, token),
    setMenuItemAvailability: (token: string, menuItemId: string, input: { status: 'PUBLISHED' | 'UNAVAILABLE' | 'INACTIVE'; reason?: string }) => request<MenuItem>(`/v1/menu/items/${menuItemId}/availability`, { method: 'POST', body: JSON.stringify(input) }, token),
    createRecipe: (token: string, input: { menuItemId: string; stationCode: 'KITCHEN' | 'BAR'; lines: { ingredientId: string; quantity: number; unit: string }[] }) => request<RecipeVersion>('/v1/recipes', { method: 'POST', body: JSON.stringify(input) }, token),
    publishRecipe: (token: string, recipeId: string) => request<RecipeVersion>(`/v1/recipes/${recipeId}/publish`, { method: 'POST' }, token)
  };
}
