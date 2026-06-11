import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { MenuVo } from '@/types/api'
import { menuFullPath } from '@/router/routeGenerator'
import { resolveMenuLabel } from '@/utils/menuLabel'
import { LAYOUT_ROUTE_NAME } from '@/router/constants'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/'
}

export function resolveRouteTitle(
  route: RouteLocationNormalizedLoaded,
  t: (key: string) => string,
): string {
  const titleKey = route.meta.titleKey as string | undefined
  if (titleKey) return t(titleKey)
  const title = route.meta.title as string | undefined
  if (title) return title
  return t('nav.dashboard')
}

function menuLabel(menu: MenuVo, t: (key: string) => string, locale: string) {
  return resolveMenuLabel(menu, t, locale)
}

type MenuChainNode = { menu: MenuVo; path: string }

function findMenuChain(
  menus: MenuVo[],
  targetPath: string,
  parentPath = '',
  chain: MenuChainNode[] = [],
): MenuChainNode[] | null {
  const normalizedTarget = normalizePath(targetPath)

  for (const menu of menus) {
    const currentPath = menuFullPath(menu, parentPath)
    const normalizedCurrent = normalizePath(currentPath)
    const node: MenuChainNode = { menu, path: currentPath }

    if (normalizedCurrent === normalizedTarget) {
      return [...chain, node]
    }

    if (menu.children?.length) {
      const parentForChildren = normalizedCurrent === '/' ? '' : currentPath
      const found = findMenuChain(menu.children, targetPath, parentForChildren, [...chain, node])
      if (found) return found
    }
  }

  return null
}

export function findMenuByPath(menus: MenuVo[], targetPath: string): MenuVo | undefined {
  const chain = findMenuChain(menus, targetPath)
  return chain?.[chain.length - 1]?.menu
}

function buildFromMatched(
  route: RouteLocationNormalizedLoaded,
  t: (key: string) => string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = []

  for (const record of route.matched) {
    if (!record.name || record.name === LAYOUT_ROUTE_NAME) continue
    const titleKey = record.meta.titleKey as string | undefined
    const title = record.meta.title as string | undefined
    if (!titleKey && !title) continue

    items.push({
      label: titleKey ? t(titleKey) : title!,
      to: undefined,
    })
  }

  if (items.length > 1) {
    let pathPrefix = ''
    for (let i = 0; i < items.length - 1; i++) {
      const record = route.matched.filter((r) => r.name && r.name !== LAYOUT_ROUTE_NAME)[i]
      if (record?.path) {
        pathPrefix = record.path.startsWith('/')
          ? record.path
          : `${pathPrefix}/${record.path}`.replace(/\/+/g, '/')
        items[i].to = pathPrefix || '/'
      }
    }
  }

  return items
}

export function buildBreadcrumbs(
  menus: MenuVo[],
  route: RouteLocationNormalizedLoaded,
  t: (key: string) => string,
  locale = 'zh',
): BreadcrumbItem[] {
  const chain = findMenuChain(menus, route.path)

  if (chain?.length) {
    return chain.map((node, index) => {
      const isLast = index === chain.length - 1
      return {
        label: menuLabel(node.menu, t, locale),
        to: isLast ? undefined : normalizePath(node.path),
      }
    })
  }

  const matched = buildFromMatched(route, t)
  if (matched.length) return matched

  return [{ label: resolveRouteTitle(route, t) }]
}
