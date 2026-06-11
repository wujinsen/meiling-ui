import type { Component } from 'vue'
import type { Router } from 'vue-router'
import type { MenuVo } from '@/types/api'
import { menuFullPath } from '@/router/routeGenerator'
import { resolveMenuIcon } from '@/utils/menuIcons'
import { resolveMenuLabel } from '@/utils/menuLabel'

export type CommandPaletteItem = {
  id: string
  label: string
  icon: Component
  group: string
  keywords: string
  action: () => void
}

function visibleChildren(menu: MenuVo) {
  return menu.children?.filter((child) => child.menuType !== 'F' && !child.hidden) ?? []
}

function buildKeywords(menu: MenuVo, label: string, path: string) {
  return [label, path, menu.menuName, menu.menuNameEn, menu.menuNameJa, menu.path, menu.component, menu.name]
    .filter(Boolean)
    .join(' ')
}

export function buildCommandItemsFromMenus(
  menus: MenuVo[],
  t: (key: string) => string,
  locale: string,
  router: Router,
  parentPath = '',
  groupLabel = '',
): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = []

  for (const menu of menus) {
    if (menu.menuType === 'F' || menu.hidden) continue

    const label = resolveMenuLabel(menu, t, locale)
    const path = menuFullPath(menu, parentPath)
    const children = visibleChildren(menu)
    const group = groupLabel || t('command.nav')

    if (children.length) {
      items.push(...buildCommandItemsFromMenus(children, t, locale, router, path, label))
      continue
    }

    items.push({
      id: `menu-${menu.id ?? path}`,
      label,
      icon: resolveMenuIcon(menu.icon || menu.meta?.icon),
      group,
      keywords: buildKeywords(menu, label, path),
      action: () => router.push(path),
    })
  }

  return items
}

export function filterCommandItems(items: CommandPaletteItem[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => `${item.label} ${item.group} ${item.keywords}`.toLowerCase().includes(q))
}
