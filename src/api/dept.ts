import { request } from '@/api/http'
import type { DeptQuery, DeptVo, SysDept } from '@/types/dept'
import { jsonEntityBody } from '@/utils/id'

export async function listDeptApi(params?: DeptQuery) {
  const qs = new URLSearchParams()
  if (params?.deptName?.trim()) qs.set('deptName', params.deptName.trim())
  if (params?.status !== undefined && params.status !== '') qs.set('status', String(params.status))
  const query = qs.toString()
  return request<DeptVo[]>(`/dept/list${query ? `?${query}` : ''}`, { method: 'GET' })
}

export async function getDeptTreeListApi() {
  return request<DeptVo[]>('/dept/getDeptTreeList', { method: 'GET' })
}

export async function getDeptApi(id: number | string) {
  return request<SysDept>(`/dept/${id}`, { method: 'GET' })
}

export async function addDeptApi(data: SysDept) {
  return request<boolean>('/dept', {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateDeptApi(data: SysDept) {
  return request<boolean>('/dept', {
    method: 'PUT',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function deleteDeptApi(id: number | string) {
  return request<boolean>(`/dept/${id}`, { method: 'DELETE' })
}
