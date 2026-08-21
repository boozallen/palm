/**
 * Recursively strips null bytes (\u0000) from strings.
 * PostgreSQL rejects them in JSON columns (e.g. when document file content is stored).
 */
export function sanitizeForPostgres<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForPostgres) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeForPostgres(v)])
    ) as unknown as T;
  }
  return value;
}
