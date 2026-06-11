import { getStoredUser } from '@/utils/authSession'

/** 与后端 CommonConstant.SUPER_ADMIN / LEGACY_SUPER_ADMIN 保持一致 */
const FULL_PERMISSION_USERS = new Set(['superadmin', 'admin'])

export function hasFullPermission(userName?: string | null): boolean {
  if (!userName) return false
  return FULL_PERMISSION_USERS.has(userName)
}

export function isSuperAdmin(userName?: string | null): boolean {
  return hasFullPermission(userName)
}

export function isCurrentUserSuperAdmin(): boolean {
  return hasFullPermission(getStoredUser()?.userName)
}
