import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { LoginLogQuery, SysLoginLog } from '@/types/loginlog'

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export async function listLoginLogApi(params?: LoginLogQuery) {
  return request<PageRes<SysLoginLog>>(
    `/log/loginLogList${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

export async function deleteLoginLogApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/log/loginLog/${idStr}`, { method: 'DELETE' })
}

export async function cleanLoginLogApi() {
  return request<boolean>('/log/loginLog/clean', { method: 'DELETE' })
}
