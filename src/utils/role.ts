import type { SysRole } from '@/types/role'

/** 与 baseline `sys_role` 内置角色一致，不可通过用户管理分配 */
export const BUILTIN_SUPER_ADMIN_ROLE_NAME = '超级管理员'

export function isBuiltinSuperAdminRole(role: Pick<SysRole, 'roleName'>): boolean {
  return role.roleName?.trim() === BUILTIN_SUPER_ADMIN_ROLE_NAME
}

export function filterAssignableRoles<T extends Pick<SysRole, 'roleName'>>(roles: T[]): T[] {
  return roles.filter((role) => !isBuiltinSuperAdminRole(role))
}
