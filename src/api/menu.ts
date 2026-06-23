import { request } from '@/api/http'
import { getDefaultMenus } from '@/router/defaultMenus'
import type { MenuVo, MoliResult } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import type { MenuQuery, SysMenu } from '@/types/menu'
import { jsonEntityBody } from '@/utils/id'

/**
 * 当前用户可访问的路由菜单。
 * 用于：侧栏导航 + 动态路由注册。
 */
export async function getRoutersApi(): Promise<MoliResult<MenuVo[]>> {
  try {
    const result = await request<MenuVo[]>('/menu/getRouters', { method: 'GET' })
    if (result.code === API_SUCCESS_CODE) {
      return result
    }
  } catch {
    // 后端未就绪
  }

  return {
    code: API_SUCCESS_CODE,
    msg: '使用前端默认菜单',
    data: getDefaultMenus(),
  }
}

/**
 * 完整菜单树 — 仅用于「菜单管理」等系统管理页面（如角色授权、菜单 CRUD）。
 * 不参与登录后的侧栏与路由加载。
 */
export async function getMenuTreeAllApi(): Promise<MoliResult<MenuVo[]>> {
  return request<MenuVo[]>('/menu/getMenuTreeAll', { method: 'GET' })
}

export async function listMenuApi(params?: MenuQuery) {
  const qs = new URLSearchParams()
  if (params?.menuName?.trim()) qs.set('menuName', params.menuName.trim())
  if (params?.status !== undefined && params.status !== '') qs.set('status', String(params.status))
  const query = qs.toString()
  return request<SysMenu[]>(`/menu/list${query ? `?${query}` : ''}`, { method: 'GET' })
}

export async function getMenuApi(id: number | string) {
  return request<SysMenu>(`/menu/${id}`, { method: 'GET' })
}

export async function addMenuApi(data: SysMenu) {
  return request<boolean>('/menu', {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateMenuApi(data: SysMenu) {
  return request<boolean>('/menu', {
    method: 'PUT',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function deleteMenuApi(id: number | string) {
  return request<boolean>(`/menu/${id}`, { method: 'DELETE' })
}

/** 角色授权：返回完整菜单树，首项携带该角色已选 menuIds */
export async function selectMenuTreeByRoleIdApi(roleId: number | string) {
  return request<MenuVo[]>(`/menu/selectMenuTreeByRoleId/${roleId}`, { method: 'GET' })
}
