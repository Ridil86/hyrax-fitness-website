/**
 * Small input-validation helpers for route handlers. Keep pure — no DB, no
 * AWS SDK. Callers translate failures into responses.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Trim + cap a string. Null/undefined/non-strings throw. */
export function limitString(
  value: unknown,
  max: number,
  fieldName: string
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  if (trimmed.length > max) {
    throw new ValidationError(
      `${fieldName} must be ${max} characters or fewer`
    );
  }
  return trimmed;
}

/** Cap a string but allow empty/null. Returns null for empty. */
export function limitStringOptional(
  value: unknown,
  max: number,
  fieldName: string
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) {
    throw new ValidationError(
      `${fieldName} must be ${max} characters or fewer`
    );
  }
  return trimmed;
}

/** Cap an array's length; optionally validate each item. */
export function limitArray<T>(
  value: unknown,
  max: number,
  fieldName: string,
  itemValidator?: (item: unknown, index: number) => T
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  if (value.length > max) {
    throw new ValidationError(`${fieldName} cannot have more than ${max} items`);
  }
  if (itemValidator) {
    return value.map((item, i) => itemValidator(item, i));
  }
  return value as T[];
}

/** Enum allow-list. */
export function limitEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowed.join(', ')}`
    );
  }
  return value as T;
}

export function limitEnumOptional<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string
): T | null {
  if (value === null || value === undefined || value === '') return null;
  return limitEnum(value, allowed, fieldName);
}

/** Bounded integer. */
export function limitInt(
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ValidationError(`${fieldName} must be an integer`);
  }
  if (n < min || n > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
  return n;
}

export function limitIntOptional(
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): number | null {
  if (value === null || value === undefined || value === '') return null;
  return limitInt(value, min, max, fieldName);
}

/** Bounded number (float). */
export function limitNumber(
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`${fieldName} must be a number`);
  }
  if (n < min || n > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
  return n;
}
