import { request } from '@/api/http'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { API_SUCCESS_CODE } from '@/types/api'
import { normalizePageRes, type PageRes } from '@/types/page'

export type ActionVo = {
  id?: number | string
  permCode: string
  name: string
  menuId?: number | string
  orderNum?: number
  resource?: string
  action?: string
  status?: number
  menuName?: string
}

export type ActionQuery = {
  pageNum?: number
  pageSize?: number
  permCode?: string
  name?: string
  menuId?: number | string
  status?: number | ''
}

export async function listActionsByMenuApi(menuId: number | string) {
  return request<ActionVo[]>(`/action/list?menuId=${menuId}`, { method: 'GET' })
}

export async function pageActionApi(query: ActionQuery) {
  const params = new URLSearchParams()
  if (query.pageNum != null) params.set('pageNum', String(query.pageNum))
  if (query.pageSize != null) params.set('pageSize', String(query.pageSize))
  if (query.permCode) params.set('permCode', query.permCode)
  if (query.name) params.set('name', query.name)
  if (query.menuId != null && query.menuId !== '') params.set('menuId', String(query.menuId))
  if (query.status !== '' && query.status != null) params.set('status', String(query.status))
  return request<PageRes<ActionVo>>(`/action/page?${params}`, { method: 'GET' })
}

export async function getActionApi(id: number | string) {
  return request<ActionVo>(`/action/${id}`, { method: 'GET' })
}

export async function addActionApi(payload: ActionVo) {
  return request<boolean>('/action', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateActionApi(payload: ActionVo) {
  return request<boolean>('/action', { method: 'PUT', body: JSON.stringify(payload) })
}

export async function changeActionStatusApi(id: number | string, status: number) {
  return request<boolean>('/action/changeStatus', {
    method: 'PUT',
    body: JSON.stringify({ id, status }),
  })
}

export async function deleteActionApi(ids: string) {
  return request<boolean>(`/action/${ids}`, { method: 'DELETE' })
}

type ActionMenuRef = { id?: number | string; menuName?: string }

function filterActions(items: ActionVo[], query: ActionQuery) {
  let filtered = items
  const perm = query.permCode?.trim().toLowerCase()
  const name = query.name?.trim().toLowerCase()
  if (perm) filtered = filtered.filter((row) => row.permCode?.toLowerCase().includes(perm))
  if (name) filtered = filtered.filter((row) => row.name?.toLowerCase().includes(name))
  if (query.menuId != null && query.menuId !== '') {
    filtered = filtered.filter((row) => String(row.menuId) === String(query.menuId))
  }
  if (query.status !== '' && query.status != null) {
    filtered = filtered.filter((row) => row.status === query.status)
  }
  return filtered
}

/** 优先分页接口；旧后端无 /action/page 时按菜单聚合 /action/list */
export async function fetchActionPage(
  query: ActionQuery,
  pageMenus: ActionMenuRef[] = [],
): Promise<PageRes<ActionVo>> {
  try {
    const result = await pageActionApi(query)
    if (result.code === API_SUCCESS_CODE && result.data) {
      return normalizePageRes(result.data)
    }
  } catch {
    /* fallback below */
  }

  const batches = await Promise.all(
    pageMenus.map(async (menu) => {
      if (menu.id == null) return [] as ActionVo[]
      try {
        const result = await listActionsByMenuApi(menu.id)
        if (result.code !== API_SUCCESS_CODE || !result.data) return []
        return result.data.map((row) => ({ ...row, menuName: row.menuName ?? menu.menuName }))
      } catch {
        return []
      }
    }),
  )

  const filtered = filterActions(batches.flat(), query)
  const pageNum = query.pageNum ?? 1
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const start = (pageNum - 1) * pageSize
  return {
    total: filtered.length,
    pageNum,
    pageSize,
    list: filtered.slice(start, start + pageSize),
  }
}
