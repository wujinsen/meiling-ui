import { ref } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuVo } from '@/types/api'
import { getRoutersApi } from '@/api/menu'
import { getDefaultMenus, mergeSidebarMenus, excludeStaticMenuRoutes } from '@/router/defaultMenus'
import { LAYOUT_ROUTE_NAME } from '@/router/constants'
import { STATIC_ROUTE_NAMES } from '@/router/staticRoutes'
import { generateRoutesFromMenus, filterSidebarMenus } from '@/router/routeGenerator'
import { clearMenus, getStoredMenus, getToken, saveMenus } from '@/utils/authSession'

/** 侧栏菜单（来自 getRouters） */
const menus = ref<MenuVo[]>(resolveInitialMenus())
const routesLoaded = ref(false)
const addedRouteNames = ref<string[]>([])
const usingBackendMenus = ref(false)

let loadingPromise: Promise<boolean> | null = null

function resolveInitialMenus() {
  const stored = getStoredMenus()
  if (stored.length) return stored
  return getToken() ? [] : getDefaultMenus()
}

function collectRouteNames(routeList: RouteRecordRaw[], names: string[] = []) {
  for (const route of routeList) {
    if (route.name) names.push(route.name as string)
    if (route.children?.length) collectRouteNames(route.children, names)
  }
  return names
}

function isStaticRoute(route: RouteRecordRaw): boolean {
  if (route.name && STATIC_ROUTE_NAMES.has(route.name as string)) return true
  if (route.children?.length) {
    return route.children.every((child) => isStaticRoute(child))
  }
  return false
}

function filterBackendOnlyRoutes(routeList: RouteRecordRaw[]): RouteRecordRaw[] {
  const filtered: RouteRecordRaw[] = []

  for (const route of routeList) {
    if (isStaticRoute(route)) continue

    const children = route.children?.length ? filterBackendOnlyRoutes(route.children) : undefined
    if (children?.length || route.component) {
      filtered.push(children?.length ? { ...route, children } : route)
    }
  }

  return filtered
}

export function initPermission() {
  menus.value = resolveInitialMenus()
}

export async function loadDynamicRoutes(force = false) {
  if (routesLoaded.value && !force) return true
  if (loadingPromise && !force) return loadingPromise

  loadingPromise = (async () => {
    const { router } = await import('@/router')
    const result = await getRoutersApi()

    const isFallback = result.msg === '使用前端默认菜单'
    usingBackendMenus.value = !isFallback

    const menuSource = isFallback ? getDefaultMenus() : mergeSidebarMenus(result.data ?? [])
    menus.value = filterSidebarMenus(menuSource)
    saveMenus(menus.value)

    const dynamicRoutes = isFallback
      ? generateRoutesFromMenus(excludeStaticMenuRoutes(getDefaultMenus()))
      : filterBackendOnlyRoutes(generateRoutesFromMenus(result.data ?? []))

    const names = collectRouteNames(dynamicRoutes)

    for (const name of addedRouteNames.value) {
      if (router.hasRoute(name)) router.removeRoute(name)
    }

    for (const route of dynamicRoutes) {
      router.addRoute(LAYOUT_ROUTE_NAME, route)
    }

    addedRouteNames.value = names
    routesLoaded.value = true
    return true
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}

export async function resetDynamicRoutes() {
  const { router } = await import('@/router')
  for (const name of addedRouteNames.value) {
    if (router.hasRoute(name)) router.removeRoute(name)
  }
  addedRouteNames.value = []
  routesLoaded.value = false
  usingBackendMenus.value = false
  menus.value = getToken() ? [] : getDefaultMenus()
  clearMenus()
}

export function getPermissionMenus() {
  return menus.value
}

export function isUsingBackendMenus() {
  return usingBackendMenus.value
}

export function usePermission() {
  return {
    menus,
    routesLoaded,
    usingBackendMenus,
    loadDynamicRoutes,
    resetDynamicRoutes,
  }
}
