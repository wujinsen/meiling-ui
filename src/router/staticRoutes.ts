import type { RouteRecordRaw } from 'vue-router'

/** 不依赖后端菜单、所有登录用户均可访问的路由 */
export const STATIC_ROUTE_NAMES = new Set(['profile', 'settings'])

export const staticAppRoutes: RouteRecordRaw[] = [
  {
    path: 'profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { titleKey: 'profile.title' },
  },
  {
    path: 'settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'nav.settings' },
  },
]
