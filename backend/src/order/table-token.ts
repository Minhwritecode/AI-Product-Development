import { createHmac, timingSafeEqual } from 'node:crypto';
import { assert } from '../platform/errors.js';

type Payload = { tableId: string; branchId: string; version: number; expiresAt: number };

const encode = (payload: Payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');

const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function issueTableToken(payload: Payload, secret: string): string {
  const body = encode(payload);

  return `${body}.${sign(body, secret)}`;
}

export function verifyTableToken(token: string, secret: string): Payload {
  const [body, signature] = token.split('.');
  assert(body && signature, 'UNAUTHENTICATED', 'Table QR is invalid', 401);
  const expected = sign(body, secret);
  assert(signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), 'UNAUTHENTICATED', 'Table QR is invalid', 401);
  // SAFETY: the signed token was created by issueTableToken; fields are verified immediately below before use.
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
  assert(parsed.tableId && parsed.branchId && Number.isInteger(parsed.version) && parsed.expiresAt > Date.now(), 'UNAUTHENTICATED', 'Table QR is expired', 401);

  return parsed;
}
