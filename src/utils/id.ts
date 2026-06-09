/** Preserve snowflake IDs — never pass through Number(). */
export function toEntityId(value?: number | string | null): string | undefined {
  if (value == null || value === '') return undefined
  return String(value)
}

/** Root uses 0; child IDs stay as strings to avoid precision loss. */
export function toParentId(value?: number | string | null): number | string {
  if (value == null || value === '' || String(value) === '0') return 0
  return String(value)
}
