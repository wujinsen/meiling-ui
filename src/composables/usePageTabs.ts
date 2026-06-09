import { ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { normalizePath } from '@/utils/breadcrumb'
import { LAYOUT_ROUTE_NAME } from '@/router/constants'

export interface PageTab {
  key: string
  path: string
  fullPath: string
  titleKey?: string
  title?: string
  affix?: boolean
}

const tabs = ref<PageTab[]>([])

function isAffixRoute(route: RouteLocationNormalizedLoaded) {
  return route.name === 'dashboard' || normalizePath(route.path) === '/'
}

function shouldTrackRoute(route: RouteLocationNormalizedLoaded) {
  if (route.meta.public) return false
  if (route.name === LAYOUT_ROUTE_NAME || route.name === 'login') return false
  return Boolean(route.name || normalizePath(route.path) !== '/')
}

function createTab(route: RouteLocationNormalizedLoaded): PageTab {
  return {
    key: route.fullPath,
    path: route.path,
    fullPath: route.fullPath,
    titleKey: route.meta.titleKey as string | undefined,
    title: route.meta.title as string | undefined,
    affix: isAffixRoute(route),
  }
}

export function addPageTab(route: RouteLocationNormalizedLoaded) {
  if (!shouldTrackRoute(route)) return

  const tab = createTab(route)
  const index = tabs.value.findIndex((item) => item.key === tab.key)
  if (index === -1) {
    tabs.value.push(tab)
    return
  }

  tabs.value[index] = { ...tabs.value[index], ...tab }
}

export function resetPageTabs() {
  tabs.value = []
}

export function usePageTabs() {
  async function switchTab(tab: PageTab) {
    const { router } = await import('@/router')
    if (normalizePath(router.currentRoute.value.fullPath) === normalizePath(tab.fullPath)) return
    await router.push(tab.fullPath)
  }

  async function closeTab(key: string) {
    const { router } = await import('@/router')
    const index = tabs.value.findIndex((item) => item.key === key)
    if (index === -1) return

    const tab = tabs.value[index]
    if (tab.affix) return

    const isActive = normalizePath(router.currentRoute.value.fullPath) === normalizePath(tab.fullPath)
    tabs.value.splice(index, 1)

    if (!isActive) return

    const nextTab = tabs.value[index] ?? tabs.value[index - 1]
    await router.push(nextTab?.fullPath ?? '/')
  }

  async function closeOtherTabs(key: string) {
    const { router } = await import('@/router')
    const current = tabs.value.find((item) => item.key === key)
    if (!current) return

    tabs.value = tabs.value.filter((item) => item.affix || item.key === key)

    if (normalizePath(router.currentRoute.value.fullPath) !== normalizePath(current.fullPath)) {
      await router.push(current.fullPath)
    }
  }

  async function closeAllTabs() {
    const { router } = await import('@/router')
    tabs.value = tabs.value.filter((item) => item.affix)
    await router.push('/')
  }

  return {
    tabs,
    addPageTab,
    resetPageTabs,
    switchTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
  }
}
