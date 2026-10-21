import { createApiClient } from './api';

const apiRoot = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

export const api = createApiClient(apiRoot);
