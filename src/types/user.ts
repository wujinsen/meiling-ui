import type { SysRole } from '@/types/role'

export type UserVo = {
  id?: number | string
  deptId?: number | string
  workNo?: string
  nickName?: string
  userName?: string
  password?: string
  identityCard?: string
  sex?: number
  telephone?: string
  address?: string
  email?: string
  workTime?: string
  isJob?: number
  status?: number
  deptName?: string
  postIds?: (number | string)[]
  roleIds?: (number | string)[]
  roleNames?: string
  createTime?: string | number
  remark?: string
}

export type UserRoleVo = {
  userId?: number | string
  userIds?: (number | string)[]
  roleId?: number | string
  roleIds?: (number | string)[]
  user?: UserVo
  roleList?: SysRole[]
}

export type SysUserVo = UserVo & {
  postNames?: string
  language?: string
  roleList?: SysRole[]
}

export type UserQuery = {
  pageNum?: number
  pageSize?: number
  userName?: string
  telephone?: string
  status?: number | ''
  deptId?: number | string | ''
  roleId?: number | string
  systemId?: number | string
  beginTime?: string
  endTime?: string
}

export function createEmptyUser(): UserVo {
  return {
    deptId: undefined,
    nickName: '',
    userName: '',
    password: '',
    telephone: '',
    email: '',
    sex: 0,
    status: 1,
    postIds: [],
    remark: '',
  }
}
