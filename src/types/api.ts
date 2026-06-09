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
  name?: string
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
}

export type LoginPayload = {
  userName: string
  password: string
}

export const API_SUCCESS_CODE = 200
export const API_TOKEN_INVALID_CODE = 10006
