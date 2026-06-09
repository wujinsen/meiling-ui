import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { RoleQuery, RoleVo, SysRole } from '@/types/role'

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export async function listRoleApi(params?: RoleQuery) {
  return request<PageRes<SysRole>>(`/role/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function getRoleApi(id: number | string) {
  return request<SysRole>(`/role/${id}`, { method: 'GET' })
}

export async function addRoleApi(data: RoleVo) {
  return request<boolean>('/role', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateRoleApi(data: RoleVo) {
  return request<boolean>('/role', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteRoleApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/role/${idStr}`, { method: 'DELETE' })
}

export async function changeRoleStatusApi(id: number | string, status: number) {
  return request<boolean>('/role/changeStatus', {
    method: 'PUT',
    body: JSON.stringify({ id, status }),
  })
}

export async function getRoleAllApi() {
  return request<SysRole[]>('/role/getRoleAll', { method: 'GET' })
}
