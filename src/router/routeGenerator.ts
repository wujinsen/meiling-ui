import type { RouteRecordRaw } from 'vue-router'
import type { MenuVo } from '@/types/api'
import { resolveViewComponent } from '@/router/viewRegistry'
import { resolveTitleKey } from '@/utils/menuLabel'

const LAYOUT_COMPONENTS = new Set(['Layout', 'ParentView', 'InnerLink'])

type RouteNameContext = {
  usedNames: Set<string>
}

function normalizeSegment(path: string) {
  return path.replace(/^\//, '')
}

function isVisibleMenu(menu: MenuVo) {
  return menu.menuType !== 'F' && !menu.hidden
}

function capitalizeSegment(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** 从 component 推导唯一路由名（与后端约定：system/system/index → SystemRegistry） */
export function deriveRouteNameFromComponent(component?: string): string | undefined {
  if (!component?.trim() || LAYOUT_COMPONENTS.has(component)) return undefined
  const parts = component.replace(/\/index$/i, '').split('/').filter(Boolean)
  if (!parts.length) return undefined
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    return `${capitalizeSegment(parts[parts.length - 1])}Registry`
  }
  return capitalizeSegment(parts[parts.length - 1])
}

/**
 * 分配唯一 Vue Router name。
 * 优先 component 推导（system/system/index → SystemRegistry），避免与父级目录 System 冲突。
 */
function allocateRouteName(
  menu: MenuVo,
  fallback: string,
  ctx: RouteNameContext,
  forbiddenNames?: Set<string>,
): string {
  const explicit = menu.routeName?.trim() || menu.name?.trim()
  const derived = deriveRouteNameFromComponent(menu.component)
  const cappedFallback = fallback ? capitalizeSegment(fallback) : undefined

  const candidates = [
    explicit,
    derived,
    fallback || undefined,
    cappedFallback && cappedFallback !== fallback ? cappedFallback : undefined,
    menu.id != null ? `Route${menu.id}` : undefined,
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (forbiddenNames?.has(candidate)) continue
    if (!ctx.usedNames.has(candidate)) {
      ctx.usedNames.add(candidate)
      return candidate
    }
  }

  const base = derived || explicit || cappedFallback || fallback || 'Route'
  let suffix = 2
  while (ctx.usedNames.has(`${base}${suffix}`)) suffix += 1
  const unique = `${base}${suffix}`
  ctx.usedNames.add(unique)
  return unique
}

function routeMeta(menu: MenuVo) {
  return {
    title: menu.meta?.title || menu.menuName,
    titleKey: menu.meta?.titleKey || resolveTitleKey(menu),
    icon: menu.icon,
    perms: menu.perms,
    menuId: menu.id,
  }
}

function leafRoute(
  menu: MenuVo,
  relativePath: string,
  ctx: RouteNameContext,
  forbiddenNames?: Set<string>,
): RouteRecordRaw {
  return {
    path: relativePath,
    name: allocateRouteName(menu, relativePath, ctx, forbiddenNames),
    component: resolveViewComponent(menu.component || ''),
    meta: routeMeta(menu),
  }
}

function flattenChildren(
  children: MenuVo[],
  ctx: RouteNameContext,
  ancestorNames: Set<string> = new Set(),
): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []

  for (const child of children) {
    if (!isVisibleMenu(child)) continue

    const segment = normalizeSegment(child.path || '')

    if (child.menuType === 'M' && child.children?.length) {
      if (child.component === 'ParentView') {
        for (const nested of flattenChildren(child.children, ctx, ancestorNames)) {
          routes.push({
            ...nested,
            path: `${segment}/${nested.path}`.replace(/\/+/g, '/'),
          })
        }
      } else {
        const branchCtx: RouteNameContext = { usedNames: new Set(ctx.usedNames) }
        const parentName = allocateRouteName(child, segment, branchCtx, ancestorNames)
        const nextAncestors = new Set(ancestorNames)
        nextAncestors.add(parentName)
        const nested = flattenChildren(child.children, branchCtx, nextAncestors)
        if (!nested.length) continue
        routes.push({
          path: segment,
          name: parentName,
          meta: {
            title: child.meta?.title || child.menuName,
            titleKey: child.meta?.titleKey || resolveTitleKey(child),
            icon: child.icon,
          },
          redirect: { name: nested[0].name as string },
          children: nested,
        })
      }
      continue
    }

    if (child.menuType === 'C' && child.component && !LAYOUT_COMPONENTS.has(child.component)) {
      routes.push(leafRoute(child, segment, ctx, ancestorNames))
    }
  }

  return routes
}

export function generateRoutesFromMenus(menus: MenuVo[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []
  const rootCtx: RouteNameContext = { usedNames: new Set() }

  for (const menu of menus) {
    if (!isVisibleMenu(menu)) continue

    const topSegment = normalizeSegment(menu.path || '')

    if (menu.menuType === 'M' && menu.children?.length) {
      const parentName = allocateRouteName(menu, topSegment, rootCtx)
      const branchCtx: RouteNameContext = { usedNames: new Set(rootCtx.usedNames) }
      const children = flattenChildren(menu.children, branchCtx, new Set([parentName]))
      if (!children.length) continue

      routes.push({
        path: topSegment,
        name: parentName,
        meta: {
          title: menu.meta?.title || menu.menuName,
          titleKey: menu.meta?.titleKey || resolveTitleKey(menu),
          icon: menu.icon,
        },
        redirect: { name: children[0].name as string },
        children,
      })
      continue
    }

    if (menu.menuType === 'C' && menu.component && !LAYOUT_COMPONENTS.has(menu.component)) {
      routes.push(leafRoute(menu, topSegment, rootCtx))
    }
  }

  return routes
}

export function filterSidebarMenus(menus: MenuVo[]): MenuVo[] {
  return menus
    .filter(isVisibleMenu)
    .map((menu) => ({
      ...menu,
      children: menu.children?.length ? filterSidebarMenus(menu.children) : undefined,
    }))
}

export function menuFullPath(menu: MenuVo, parentPath = '') {
  const segment = normalizeSegment(menu.path || '')
  if (!parentPath) {
    return segment ? `/${segment}` : '/'
  }
  return `${parentPath.replace(/\/$/, '')}/${segment}`.replace(/\/+/g, '/')
}

export function resolveDefaultPath(menuList: MenuVo[]) {
  for (const menu of menuList) {
    if (menu.name === 'Dashboard' || menu.component === 'meiling/dashboard/index') {
      return menuFullPath(menu)
    }
  }
  for (const menu of menuList) {
    if (menu.menuType === 'C') return menuFullPath(menu)
    const child = menu.children?.[0]
    if (child) return menuFullPath(child, menuFullPath(menu))
  }
  return '/profile'
}

export function collectAllowedPaths(menus: MenuVo[], parentPath = '') {
  const paths = new Set<string>()

  for (const menu of menus) {
    if (!isVisibleMenu(menu)) continue

    const fullPath = menuFullPath(menu, parentPath)

    if (menu.menuType === 'C' && menu.component && !LAYOUT_COMPONENTS.has(menu.component)) {
      paths.add(fullPath)
    }

    if (menu.children?.length) {
      for (const childPath of collectAllowedPaths(menu.children, fullPath)) {
        paths.add(childPath)
      }
    }
  }

  return paths
}

export function isPathAllowed(path: string, menus: MenuVo[]) {
  const allowed = collectAllowedPaths(menus)
  if (allowed.has(path)) return true
  return [...allowed].some((allowedPath) => {
    if (allowedPath === '/') return path === '/'
    return path.startsWith(`${allowedPath}/`)
  })
}
