import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { SysSystem, SystemEnterVo, SystemVo } from '@/types/system'

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export async function mySystemsApi() {
  return request<SystemVo[]>('/system/my', { method: 'GET' })
}

export async function enterSystemApi(systemId: number | string) {
  return request<SystemEnterVo>('/system/enter', {
    method: 'POST',
    body: JSON.stringify({ systemId }),
  })
}

export async function switchSystemApi(systemId: number | string) {
  return request<SystemEnterVo>('/system/switch', {
    method: 'POST',
    body: JSON.stringify({ systemId }),
  })
}

export async function listSystemApi(params?: SysSystem) {
  return request<PageRes<SysSystem>>(`/system/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function addSystemApi(data: SysSystem) {
  return request<boolean>('/system', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSystemApi(data: SysSystem) {
  return request<boolean>('/system', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSystemApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/system/${idStr}`, { method: 'DELETE' })
}
