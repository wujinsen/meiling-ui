import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { SysSystem, SystemEnterVo, SystemVo } from '@/types/system'
import { buildEntityQuery, jsonEntityBody } from '@/utils/id'

function buildQuery(params?: Record<string, string | number | undefined>) {
  return buildEntityQuery(params)
}

export async function mySystemsApi() {
  return request<SystemVo[]>('/system/my', { method: 'GET' })
}

export async function enterSystemApi(systemId: number | string) {
  return request<SystemEnterVo>('/system/enter', {
    method: 'POST',
    body: jsonEntityBody({ systemId }),
  })
}

export async function switchSystemApi(systemId: number | string) {
  return request<SystemEnterVo>('/system/switch', {
    method: 'POST',
    body: jsonEntityBody({ systemId }),
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
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateSystemApi(data: SysSystem) {
  return request<boolean>('/system', {
    method: 'PUT',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function deleteSystemApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/system/${idStr}`, { method: 'DELETE' })
}
