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
    createArea: (token: string, branchId: string, input: { name: string; sortOrder?: number }) => request<Area>(`/v1/branches/${branchId}/areas`, { method: 'POST', body: JSON.stringify(input) }, token),
    createTable: (token: string, areaId: string, input: { label: string; capacity: number; accessibilityTags?: string[] }) => request<RestaurantTable>(`/v1/areas/${areaId}/tables`, { method: 'POST', body: JSON.stringify(input) }, token)
  };
}
