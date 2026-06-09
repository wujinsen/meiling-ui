import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { OperLogQuery, SysOperationLog } from '@/types/operlog'

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export async function listOperLogApi(params?: OperLogQuery) {
  return request<PageRes<SysOperationLog>>(
    `/log/operationLogList${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

export async function deleteOperLogApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/log/operationLog/${idStr}`, { method: 'DELETE' })
}

export async function cleanOperLogApi() {
  return request<boolean>('/log/operationLog/clean', { method: 'DELETE' })
}
