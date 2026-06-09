import { createRouter, createWebHistory } from 'vue-router'
import { getToken, clearAuthSession } from '@/utils/authSession'
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

  try {
    await loadDynamicRoutes()
  } catch {
    clearAuthSession()
    await resetDynamicRoutes()
    return { name: 'login' }
  }

  if (isUsingBackendMenus()) {
    const routeName = typeof to.name === 'string' ? to.name : ''
    if (routeName && STATIC_ROUTE_NAMES.has(routeName)) {
      return true
    }

    const allowedMenus = getPermissionMenus()
    if (!isPathAllowed(to.path, allowedMenus)) {
      const fallback = resolveDefaultPath(allowedMenus)
      if (to.path !== fallback) {
        return { path: fallback }
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
