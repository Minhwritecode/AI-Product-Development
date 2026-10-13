export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function assert(condition: unknown, code: string, message: string, statusCode = 400): asserts condition {
  if (!condition) throw new AppError(code, message, statusCode);
}

export function assertPermission(actor: { permissions: string[] }, permission: string): void {
  if (!actor.permissions.includes('*') && !actor.permissions.includes(permission)) {
    throw new AppError('FORBIDDEN', `Permission required: ${permission}`, 403);
  }
}

export function assertBranchScope(actor: { branchIds: string[] }, branchId: string): void {
  if (!actor.branchIds.includes('*') && !actor.branchIds.includes(branchId)) {
    throw new AppError('OUT_OF_SCOPE', 'Resource is outside the actor branch scope', 403);
  }
}
