import { ref } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuVo } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import { getRoutersApi, MENU_DEV_FALLBACK_MSG } from '@/api/menu'
import { getDefaultMenus, mergeSidebarMenus, excludeStaticMenuRoutes } from '@/router/defaultMenus'
import { LAYOUT_ROUTE_NAME } from '@/router/constants'
import { STATIC_ROUTE_NAMES } from '@/router/staticRoutes'
import { generateRoutesFromMenus, filterSidebarMenus } from '@/router/routeGenerator'
import { mergeKnowledgeSupplementRoutes, mergeKnowledgeSupplementMenus } from '@/router/knowledgeSupplementRoutes'
import { mergeOperationSupplementRoutes, mergeOperationSupplementMenus } from '@/router/operationSupplementRoutes'
import { mergeSystemSupplementRoutes } from '@/router/systemSupplementRoutes'
import { sortMenuTree } from '@/utils/tree'
import { clearMenus, getStoredCurrentSystem, getToken, isPortalEnabledStored, saveMenus } from '@/utils/authSession'

export type ReloadRoutesResult = {
  ok: boolean
  /** Q3-A：门户开启且未 enter，getRouters 返回空树 */
  needsSystemSelect?: boolean
}

/** 侧栏菜单（来自 getRouters） */
const menus = ref<MenuVo[]>(resolveInitialMenus())
const routesLoaded = ref(false)
const addedRouteNames = ref<string[]>([])
const usingBackendMenus = ref(false)

let loadingPromise: Promise<ReloadRoutesResult> | null = null

function resolveInitialMenus() {
  // 已登录时不在本地缓存中恢复旧菜单，避免菜单结构调整后侧栏不更新
  if (getToken()) return []
  return getDefaultMenus()
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

    if (children?.length) {
      let redirect = route.redirect
      if (redirect && typeof redirect === 'object' && 'name' in redirect && redirect.name) {
        const childNames = new Set(children.map((child) => child.name).filter(Boolean) as string[])
        if (!childNames.has(redirect.name as string)) {
          redirect = children[0]?.name ? { name: children[0].name as string } : undefined
        }
      }
      filtered.push({ ...route, children, redirect })
      continue
    }

    if (route.component) {
      filtered.push(route)
    }
  }

  return filtered
}

function addDynamicRoutesSafely(router: import('vue-router').Router, routeList: RouteRecordRaw[]) {
  for (const route of routeList) {
    try {
      router.addRoute(LAYOUT_ROUTE_NAME, route)
    } catch (error) {
      console.error('[routes] failed to register route:', route.name ?? route.path, error)
    }
  }
}

export function initPermission() {
  menus.value = resolveInitialMenus()
}

async function applyMenusToRouter(menuSource: MenuVo[], options: { fromBackend: boolean; isFallback?: boolean }) {
  const { router } = await import('@/router')
  const isFallback = options.isFallback ?? false
  usingBackendMenus.value = options.fromBackend && !isFallback

  const orderedSource = isFallback ? menuSource : sortMenuTree(menuSource)
  const supplementedSource = mergeOperationSupplementMenus(mergeKnowledgeSupplementMenus(orderedSource))
  const sidebarSource = isFallback ? getDefaultMenus() : mergeSidebarMenus(supplementedSource)
  menus.value = filterSidebarMenus(sidebarSource)
  saveMenus(menus.value)

  const generatedRoutes = isFallback
    ? generateRoutesFromMenus(excludeStaticMenuRoutes(getDefaultMenus()))
    : filterBackendOnlyRoutes(generateRoutesFromMenus(supplementedSource))
  const dynamicRoutes = mergeSystemSupplementRoutes(
    mergeOperationSupplementRoutes(mergeKnowledgeSupplementRoutes(generatedRoutes)),
  )

  const names = collectRouteNames(dynamicRoutes)

  for (const name of addedRouteNames.value) {
    if (router.hasRoute(name)) router.removeRoute(name)
  }

  for (const route of dynamicRoutes) {
    addDynamicRoutesSafely(router, [route])
  }

  addedRouteNames.value = names
  routesLoaded.value = true
}

/**
 * SSO-MENU-1 · F-SSO-1：统一拉 getRouters 并注册动态路由（enter/switch/守卫唯一入口）。
 */
export async function reloadRoutesFromServer(options: { force?: boolean } = {}): Promise<ReloadRoutesResult> {
  const force = options.force ?? false
  if (routesLoaded.value && !force) {
    return { ok: true }
  }
  if (loadingPromise && !force) {
    return loadingPromise
  }

  if (force) {
    clearMenus()
  }

  loadingPromise = (async (): Promise<ReloadRoutesResult> => {
    const portalOn = isPortalEnabledStored()
    const current = getStoredCurrentSystem()

    const result = await getRoutersApi()
    const isFallback = result.msg === MENU_DEV_FALLBACK_MSG

    if (result.code !== API_SUCCESS_CODE && !isFallback) {
      throw new Error(result.msg || '加载菜单失败')
    }

    const menuSource = isFallback ? getDefaultMenus() : (result.data ?? [])

    if (!menuSource.length && portalOn && !current?.id && !isFallback) {
      await resetDynamicRoutes()
      return { ok: false, needsSystemSelect: true }
    }

    if (force) {
      const { router } = await import('@/router')
      for (const name of addedRouteNames.value) {
        if (router.hasRoute(name)) router.removeRoute(name)
      }
      addedRouteNames.value = []
      routesLoaded.value = false
    }

    await applyMenusToRouter(menuSource, { fromBackend: true, isFallback })
    return { ok: true }
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}

export async function loadDynamicRoutesFromMenus(menuList: MenuVo[]) {
  clearMenus()
  const { router } = await import('@/router')
  for (const name of addedRouteNames.value) {
    if (router.hasRoute(name)) router.removeRoute(name)
  }
  addedRouteNames.value = []
  routesLoaded.value = false
  await applyMenusToRouter(menuList, { fromBackend: true })
  return true
}

export async function loadDynamicRoutes(force = false) {
  const result = await reloadRoutesFromServer({ force })
  return result.ok
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
    reloadRoutesFromServer,
    loadDynamicRoutes,
    loadDynamicRoutesFromMenus,
    resetDynamicRoutes,
  }
}
