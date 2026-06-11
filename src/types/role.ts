export type SysRole = {
  id?: number | string
  roleName?: string
  orderNum?: number | string
  status?: number
  remark?: string
  createTime?: string | number
}

export type RoleAuthVo = {
  menuIds?: (number | string)[]
  actionCodes?: string[]
}

export type RoleVo = SysRole & {
  menuIds?: (number | string)[]
  actionCodes?: string[]
  beginTime?: string
  endTime?: string
}

export type RoleQuery = {
  pageNum?: number
  pageSize?: number
  roleName?: string
  status?: number | ''
}

export function createEmptyRole(): RoleVo {
  return {
    roleName: '',
    orderNum: 0,
    status: 1,
    remark: '',
    menuIds: [],
  }
}
