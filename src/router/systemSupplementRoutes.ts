import type { RouteRecordRaw } from 'vue-router'

export const SYSTEM_ROLE_PERM_ROUTE: RouteRecordRaw = {
  path: 'role-perm',
  name: 'SystemRolePermAssign',
  component: () => import('@/views/system/RolePermAssignView.vue'),
  meta: {
    titleKey: 'system.role.assignPerm',
    skipMenuGuard: true,
    perms: 'system:role:assignPerm',
  },
}

export function mergeSystemSupplementRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    if (route.path !== 'system' || !route.children?.length) return route
    const existing = new Set(route.children.map((child) => child.name))
    if (existing.has(SYSTEM_ROLE_PERM_ROUTE.name)) return route
    return {
      ...route,
      children: [...route.children, SYSTEM_ROLE_PERM_ROUTE],
    }
  })
}

export function rolePermAssignPath(roleId: number | string) {
  return `/system/role-perm?roleId=${encodeURIComponent(String(roleId))}`
}
