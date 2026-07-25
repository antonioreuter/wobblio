const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True when the string is a canonical UUID. Used to reject malformed ids at the domain boundary so
// they surface as a validation error instead of a Postgres 22P02 (an opaque 500) at query time.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
