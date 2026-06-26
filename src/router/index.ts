import { createRouter, createWebHistory } from 'vue-router'
import { ensurePermissionsLoaded } from '@/composables/useActionPermissions'
import { getToken, clearAuthSession, getStoredCurrentSystem, isPortalEnabledStored } from '@/utils/authSession'
import { useSystemPortal } from '@/composables/useSystemPortal'
import {
  getPermissionMenus,
  isUsingBackendMenus,
  loadDynamicRoutes,
  resetDynamicRoutes,
} from '@/composables/usePermission'
import { LAYOUT_ROUTE_NAME } from '@/router/constants'
import { STATIC_ROUTE_NAMES } from '@/router/staticRoutes'
import { isPathAllowed, resolveDefaultPath } from '@/router/routeGenerator'
import { staticAppRoutes } from '@/router/staticRoutes'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, titleKey: 'auth.signIn' },
    },
    {
      path: '/system-select',
      name: 'system-select',
      component: () => import('@/views/SystemSelectView.vue'),
      meta: { requiresAuth: true, titleKey: 'system.portal.title', skipMenuGuard: true },
    },
    {
      path: '/',
      name: LAYOUT_ROUTE_NAME,
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [...staticAppRoutes],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const loggedIn = Boolean(getToken())

  if (to.meta.public) {
    if (loggedIn && to.name === 'login') {
      if (isPortalEnabledStored() && !getStoredCurrentSystem()) {
        return { path: '/system-select' }
      }
      return { path: '/' }
    }
    return true
  }

  if (!loggedIn) {
    return {
      name: 'login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined,
    }
  }

  if (isPortalEnabledStored()) {
    const { syncPortalAccess } = useSystemPortal()
    const sync = await syncPortalAccess()
    if (!sync.allowed && to.name !== 'system-select') {
      return { path: '/system-select' }
    }
  }

  // 门户未选系统：先跳转，避免在 getRouters 上长时间阻塞
  if (isPortalEnabledStored() && !getStoredCurrentSystem() && to.name !== 'system-select') {
    return { path: '/system-select' }
  }

  // 选系统页不依赖动态菜单路由
  if (to.name !== 'system-select') {
    try {
      await Promise.all([ensurePermissionsLoaded(), loadDynamicRoutes()])
    } catch {
      clearAuthSession()
      await resetDynamicRoutes()
      return { name: 'login' }
    }
  }

  if (to.meta.skipMenuGuard || to.matched.some((record) => record.meta.skipMenuGuard)) {
    return true
  }

  if (isUsingBackendMenus()) {
    const routeName = typeof to.name === 'string' ? to.name : ''
    if (routeName && STATIC_ROUTE_NAMES.has(routeName)) {
      return true
    }

    const allowedMenus = getPermissionMenus()
    if (!isPathAllowed(to.path, allowedMenus)) {
      const fallback = resolveDefaultPath(allowedMenus)
      if (to.path !== fallback && isPathAllowed(fallback, allowedMenus)) {
        return { path: fallback }
      }
      if (to.path !== '/profile') {
        return { path: '/profile' }
      }
    }
  }

  return true
})

router.afterEach(() => {
  const main = document.querySelector('.main-scroll')
  if (main) main.scrollTop = 0
})

export default router
