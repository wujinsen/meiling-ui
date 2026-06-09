import type { RouteRecordRaw } from 'vue-router'
import type { MenuVo } from '@/types/api'
import { resolveViewComponent } from '@/router/viewRegistry'

const LAYOUT_COMPONENTS = new Set(['Layout', 'ParentView', 'InnerLink'])

function normalizeSegment(path: string) {
  return path.replace(/^\//, '')
}

function isVisibleMenu(menu: MenuVo) {
  return menu.menuType !== 'F' && !menu.hidden
}

function leafRoute(menu: MenuVo, relativePath: string): RouteRecordRaw {
  return {
    path: relativePath,
    name: menu.name || relativePath || 'index',
    component: resolveViewComponent(menu.component || ''),
    meta: {
      title: menu.meta?.title || menu.menuName,
      titleKey: menu.meta?.titleKey,
      icon: menu.icon,
      perms: menu.perms,
      menuId: menu.id,
    },
  }
}

function flattenChildren(children: MenuVo[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []

  for (const child of children) {
    if (!isVisibleMenu(child)) continue

    const segment = normalizeSegment(child.path || '')

    if (child.menuType === 'M' && child.children?.length) {
      if (child.component === 'ParentView') {
        for (const nested of flattenChildren(child.children)) {
          routes.push({
            ...nested,
            path: `${segment}/${nested.path}`.replace(/\/+/g, '/'),
          })
        }
      } else {
        const nested = flattenChildren(child.children)
        if (!nested.length) continue
        routes.push({
          path: segment,
          name: child.name,
          meta: {
            title: child.meta?.title || child.menuName,
            titleKey: child.meta?.titleKey,
            icon: child.icon,
          },
          redirect: { name: nested[0].name as string },
          children: nested,
        })
      }
      continue
    }

    if (child.menuType === 'C' && child.component && !LAYOUT_COMPONENTS.has(child.component)) {
      routes.push(leafRoute(child, segment))
    }
  }

  return routes
}

export function generateRoutesFromMenus(menus: MenuVo[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []

  for (const menu of menus) {
    if (!isVisibleMenu(menu)) continue

    const topSegment = normalizeSegment(menu.path || '')

    if (menu.menuType === 'M' && menu.children?.length) {
      const children = flattenChildren(menu.children)
      if (!children.length) continue

      routes.push({
        path: topSegment,
        name: menu.name,
        meta: {
          title: menu.meta?.title || menu.menuName,
          titleKey: menu.meta?.titleKey,
          icon: menu.icon,
        },
        redirect: { name: children[0].name as string },
        children,
      })
      continue
    }

    if (menu.menuType === 'C' && menu.component && !LAYOUT_COMPONENTS.has(menu.component)) {
      routes.push(leafRoute(menu, topSegment))
    }
  }

  return routes
}

export function filterSidebarMenus(menus: MenuVo[]): MenuVo[] {
  return menus
    .filter(isVisibleMenu)
    .map((menu) => ({
      ...menu,
      children: menu.children?.filter(isVisibleMenu).map((child) => ({
        ...child,
        children: child.children?.filter(isVisibleMenu),
      })),
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
    if (menu.menuType === 'C') return menuFullPath(menu)
    const child = menu.children?.[0]
    if (child) return menuFullPath(child, menuFullPath(menu))
  }
  return '/profile'
}

export function collectAllowedPaths(menus: MenuVo[], parentPath = ''): Set<string> {
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
