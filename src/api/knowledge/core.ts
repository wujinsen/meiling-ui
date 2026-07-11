import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type { KbWorkflowHintVo, MoliPage } from '@/types/knowledge'
import { buildEntityQuery, jsonEntityBody, toEntityId } from '@/utils/id'

export const KB_BASE = '/KnowledgeServer/kb'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK_KNOWLEDGE === 'true'

export const USE_MOCK_KB_IMPORT = import.meta.env.VITE_MOCK_KB_IMPORT === 'true'

export function isMockKnowledgeEnabled() {
  return USE_MOCK
}

export function normalizeKbPageRecords<T>(data?: MoliPage<T> | Record<string, unknown> | null) {
  if (!data || typeof data !== 'object') return { records: [] as T[], total: 0 }
  const raw = data as Record<string, unknown>
  const records = (
    Array.isArray(raw.records) ? raw.records
      : Array.isArray(raw.list) ? raw.list
        : []
  ) as T[]
  const total = Number(raw.total ?? records.length) || 0
  return { records, total }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ok<T>(data: T): MoliResult<T> {
  return { code: API_SUCCESS_CODE, msg: '成功', data }
}

export function buildQuery(params?: Record<string, string | number | undefined>) {
  return buildEntityQuery(params)
}

export { jsonEntityBody, toEntityId }

export function normalizeWorkflowHints(raw?: Array<Record<string, unknown>>) {
  if (!raw?.length) return [] as KbWorkflowHintVo[]
  return raw.map((item) => ({
    key: String(item.key ?? item.code ?? ''),
    label: String(item.label ?? ''),
    description: item.description != null ? String(item.description) : undefined,
    routePath: String(item.routePath ?? ''),
    routeQuery: item.routeQuery as Record<string, string> | undefined,
  }))
}
