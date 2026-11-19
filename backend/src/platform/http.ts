import type { FastifyRequest } from 'fastify';
import { assert } from './errors.js';
import type { Actor } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: Actor;
    sessionId?: string;
  }
}

export function envelope<T>(data: T, requestId: string) {
  return { data, meta: { requestId }, error: null };
}

export function readBody<T>(request: FastifyRequest): T {
  // SAFETY: Fastify JSON schema validation runs before this boundary; an absent body is treated as empty.
  return (request.body ?? {}) as T;
}

export function readIdempotencyKey(request: FastifyRequest): string {
  const header = request.headers['idempotency-key'];
  const value = Array.isArray(header) ? header[0] : header;
  assert(value !== undefined && value.trim().length >= 8, 'VALIDATION_ERROR', 'Idempotency-Key header is required for this command');

  return value.trim();
}

export function readGuestAccessToken(request: FastifyRequest): string {
  const header = request.headers['x-queue-access-token'];
  const value = Array.isArray(header) ? header[0] : header;
  assert(value !== undefined && value.trim().length >= 16, 'UNAUTHENTICATED', 'Queue access token is required', 401);

  return value.trim();
}

export function readTableToken(request: FastifyRequest): string {
  const header = request.headers['x-table-token'];
  const value = Array.isArray(header) ? header[0] : header;
  assert(value !== undefined && value.trim().length > 32, 'UNAUTHENTICATED', 'Table QR token is required', 401);

  return value.trim();
}

export function actor(request: FastifyRequest): Actor {
  assert(request.actor, 'UNAUTHENTICATED', 'Authentication required', 401);

  return request.actor;
}
