import type { SystemVo } from '@/types/system'

export type MoliResult<T = unknown> = {
  code: number
  msg?: string
  data?: T
}

export type SysUser = {
  id?: number
  userName: string
  nickName?: string
  password?: string
}

export type MenuMetaVo = {
  title?: string
  titleKey?: string
  icon?: string
  noCache?: boolean
  link?: string | null
}

export type MenuVo = {
  id?: number | string
  menuName?: string
  menuNameEn?: string
  menuNameJa?: string
  /** Vue Router name，来自后端 route_name */
  name?: string
  routeName?: string
  parentId?: number | string
  path?: string
  component?: string
  menuType?: string
  status?: number
  perms?: string | null
  icon?: string
  orderNum?: number
  children?: MenuVo[] | null
  hidden?: boolean
  redirect?: string
  meta?: MenuMetaVo
  alwaysShow?: boolean
  menuIds?: (number | string)[]
}

export type LoginVo = {
  token: string
  user: SysUser
  menuVoList?: MenuVo[]
  systemList?: SystemVo[]
  currentSystem?: SystemVo | null
  systemPortalEnabled?: boolean
  /** 超管登录时为 true，拥有全部菜单与 *:*:* 权限 */
  fullPermission?: boolean
  /** 有效权限码 */
  permissions?: string[]
}

export const API_AUTH_ERROR_CODE = 10009

export type LoginPayload = {
  userName: string
  password: string
}

export const API_SUCCESS_CODE = 200

/** Ingest commit/publish raw cluster gate — `data` is `KbIngestRawConflictVo`. */
export const API_INGEST_RAW_CONFLICT_CODE = 10012
export const API_TOKEN_INVALID_CODE = 10006
