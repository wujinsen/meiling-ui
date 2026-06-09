import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { DictDataQuery, DictTypeQuery, SysDictData, SysDictType } from '@/types/dict'

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export async function listDictTypeApi(params?: DictTypeQuery) {
  return request<PageRes<SysDictType>>(`/dict/type/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function listDictTypeAllApi() {
  return request<SysDictType[]>('/dict/type/listAll', { method: 'GET' })
}

export async function getDictTypeApi(id: number | string) {
  return request<SysDictType>(`/dict/type/${id}`, { method: 'GET' })
}

export async function addDictTypeApi(data: SysDictType) {
  return request<boolean>('/dict/type', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateDictTypeApi(data: SysDictType) {
  return request<boolean>('/dict/type', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteDictTypeApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/dict/type/${idStr}`, { method: 'DELETE' })
}

export async function listDictDataApi(params: DictDataQuery) {
  return request<PageRes<SysDictData>>(`/dict/data/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function getDictDataApi(id: number | string) {
  return request<SysDictData>(`/dict/data/${id}`, { method: 'GET' })
}

export async function getDictsByTypeApi(dictType: string) {
  return request<Array<{ dictLabel: string; dictValue: string; dictType: string; status: number }>>(
    `/dict/data/type/${encodeURIComponent(dictType)}`,
    { method: 'GET' },
  )
}

export async function addDictDataApi(data: SysDictData) {
  return request<boolean>('/dict/data', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateDictDataApi(data: SysDictData) {
  return request<boolean>('/dict/data', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteDictDataApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/dict/data/${idStr}`, { method: 'DELETE' })
}
