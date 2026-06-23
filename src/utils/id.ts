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

export function toEntityIdList(values?: Array<number | string | null> | null): string[] {
  if (!values?.length) return []
  return values.map((value) => toEntityId(value)).filter((id): id is string => id != null)
}

/** Normalize id / *Id / *Ids fields on outgoing JSON bodies. */
export function normalizeEntityPayload<T extends Record<string, unknown>>(payload: T): T {
  const out = { ...payload } as Record<string, unknown>
  for (const [key, value] of Object.entries(out)) {
    if (value == null) continue
    if (key.endsWith('Ids') && Array.isArray(value)) {
      out[key] = toEntityIdList(value as Array<number | string>)
    } else if (key === 'parentId') {
      out[key] = toParentId(value as number | string)
    } else if (key === 'id' || key.endsWith('Id')) {
      const normalized = toEntityId(value as number | string)
      if (normalized !== undefined) out[key] = normalized
    }
  }
  return out as T
}

export function jsonEntityBody<T extends Record<string, unknown>>(payload: T): string {
  return JSON.stringify(normalizeEntityPayload(payload))
}

/** Query string builder — serializes *Id params without Number(). */
export function buildEntityQuery(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    let serialized: string
    if (key.endsWith('Ids') && Array.isArray(value)) {
      serialized = toEntityIdList(value as Array<number | string>).join(',')
    } else if (key === 'parentId') {
      serialized = String(toParentId(value as number | string))
    } else if (key === 'id' || key.endsWith('Id')) {
      serialized = toEntityId(value as number | string) ?? String(value)
    } else {
      serialized = String(value)
    }
    qs.set(key, serialized)
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}
