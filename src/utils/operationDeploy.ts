import { MOLI_DEPLOY_SERVICES, type OperationDeployServiceOption } from '@/types/operation'

function parseServiceKeyEntry(raw: unknown): OperationDeployServiceOption | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as { key?: string; label?: string }
        if (parsed?.key) return { key: parsed.key, label: parsed.label }
      } catch {
        /* plain key string */
      }
    }
    return { key: trimmed }
  }
  if (typeof raw === 'object' && 'key' in raw) {
    const item = raw as OperationDeployServiceOption
    const key = String(item.key ?? '').trim()
    if (!key) return null
    return { key, label: item.label?.trim() || undefined }
  }
  return null
}

/** 归一化 presets.serviceKeys（兼容 string[] 与 { key, label }[]） */
export function normalizeDeployServiceKeys(
  raw?: unknown[] | null,
): OperationDeployServiceOption[] {
  if (!raw?.length) {
    return MOLI_DEPLOY_SERVICES.map((key) => ({ key }))
  }
  const seen = new Set<string>()
  const out: OperationDeployServiceOption[] = []
  for (const entry of raw) {
    const parsed = parseServiceKeyEntry(entry)
    if (!parsed || seen.has(parsed.key)) continue
    seen.add(parsed.key)
    out.push(parsed)
  }
  return out.length ? out : MOLI_DEPLOY_SERVICES.map((key) => ({ key }))
}
