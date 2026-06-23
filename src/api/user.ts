import { request } from '@/api/http'
import { isMockAuthEnabled } from '@/api/auth'
import type { PageRes } from '@/types/page'
import type { UserSystemVo } from '@/types/system'
import type { SysUserVo, UserQuery, UserRoleVo, UserVo } from '@/types/user'
import type { SysUser } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import { getStoredUser } from '@/utils/authSession'
import { buildEntityQuery, jsonEntityBody, toEntityId } from '@/utils/id'

function buildQuery(params?: Record<string, string | number | undefined>) {
  return buildEntityQuery(params)
}

export async function listUserApi(params?: UserQuery) {
  return request<PageRes<UserVo>>(`/user/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function getUserApi(id: number | string) {
  return request<SysUser>(`/user/${id}`, { method: 'GET' })
}

export async function getUserDetailApi(id: number | string) {
  return request<SysUserVo>(`/user/getUserDetail/${id}`, { method: 'GET' })
}

export async function addUserApi(data: UserVo) {
  return request<boolean>('/user', {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateUserApi(data: SysUserVo) {
  return request<boolean>('/user', {
    method: 'PUT',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function deleteUserApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/user/${idStr}`, { method: 'DELETE' })
}

export async function changeUserStatusApi(id: number | string, status: number) {
  return request<boolean>('/user/changeStatus', {
    method: 'PUT',
    body: jsonEntityBody({ id, status }),
  })
}

export async function changeSelfPasswordApi(oldPassword: string, password: string) {
  return request<string>('/user/changePassword', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, password }),
  })
}

export async function resetUserPasswordApi(id: number | string, password?: string) {
  const entityId = toEntityId(id)
  if (!entityId) {
    return { code: 500, msg: '用户ID无效' } as const
  }
  const payload: { id: string; password?: string } = { id: entityId }
  const trimmed = password?.trim()
  if (trimmed) payload.password = trimmed
  return request<string>('/user/resetPassword', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

function buildMockProfile(): SysUserVo {
  const stored = getStoredUser()
  return {
    id: stored?.id ?? 1,
    userName: stored?.userName ?? 'admin',
    nickName: stored?.nickName ?? '管理员',
    telephone: '13800138000',
    email: 'admin@meiling.io',
    sex: 1,
    deptName: '美玲科技',
    postNames: '系统管理员',
    roleList: [{ id: 2, roleName: '系统管理员' }],
    status: 1,
    language: 'zh',
    createTime: Date.now() - 86400000 * 90,
  }
}

export async function getUserProfileApi() {
  if (isMockAuthEnabled()) {
    return { code: API_SUCCESS_CODE, msg: 'ok', data: buildMockProfile() }
  }
  return request<SysUserVo>('/user/profile', { method: 'GET' })
}

export async function updateUserProfileApi(data: SysUserVo) {
  return request<boolean>('/user', {
    method: 'PUT',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateUserLanguageApi(language: string) {
  return request<boolean>('/user/language', {
    method: 'PUT',
    body: JSON.stringify({ language }),
  })
}

export async function getRoleByUserIdApi(userId: number | string) {
  return request<UserRoleVo>(`/user/getRoleByUserId/${userId}`, { method: 'GET' })
}

export async function insertUserRoleApi(data: { userId: number | string; roleIds: Array<number | string> }) {
  const userId = toEntityId(data.userId)
  if (!userId) {
    return { code: 500, msg: '用户ID无效' } as const
  }
  const roleIds = data.roleIds
    .map((id) => toEntityId(id))
    .filter((id): id is string => id != null)
  return request<boolean>('/user/insertUserRole', {
    method: 'PUT',
    body: JSON.stringify({ userId, roleIds }),
  })
}

export async function getSystemByUserIdApi(userId: number | string) {
  return request<UserSystemVo>(`/user/getSystemByUserId/${userId}`, { method: 'GET' })
}

export async function insertUserSystemApi(data: { userId: number | string; systemIds: Array<number | string> }) {
  const userId = toEntityId(data.userId)
  if (!userId) {
    return { code: 500, msg: '用户ID无效' } as const
  }
  return request<boolean>('/user/insertUserSystem', {
    method: 'PUT',
    body: jsonEntityBody({ userId, systemIds: data.systemIds }),
  })
}

export async function getUserByRoleApi(params?: UserQuery) {
  return request<PageRes<UserVo>>(
    `/user/getUserByRole${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

export async function unauthorizedUsersApi(params?: UserQuery) {
  return request<PageRes<UserVo>>(
    `/user/unauthorizedUsers${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

export async function getUserBySystemApi(params?: UserQuery) {
  return request<PageRes<UserVo>>(
    `/user/getUserBySystem${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

export async function unauthorizedUsersBySystemApi(params?: UserQuery) {
  return request<PageRes<UserVo>>(
    `/user/unauthorizedUsersBySystem${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

export async function addUserRoleApi(data: { roleId: number | string; userIds: Array<number | string> }) {
  return request<boolean>('/user/addUserRole', {
    method: 'PUT',
    body: jsonEntityBody(data),
  })
}

export async function removeUsersFromRoleApi(data: { roleId: number | string; userIds: Array<number | string> }) {
  return request<boolean>('/user/removeUsers', {
    method: 'PUT',
    body: jsonEntityBody(data),
  })
}
