import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 32;

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');

  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [, salt, expectedHex] = encoded.split('$');

  if (!salt || !expectedHex) return false;

  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
