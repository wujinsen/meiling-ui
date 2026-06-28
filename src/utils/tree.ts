import type { MenuVo } from '@/types/api'

function menuOrderNum(menu: { orderNum?: number }) {
  return menu.orderNum ?? 0
}

/** 按 orderNum 递归排序菜单树（侧栏、路由与库表顺序一致） */
export function sortMenuTreeByOrderNum<T extends { orderNum?: number; children?: T[] | null }>(
  menus: T[],
): T[] {
  return [...menus]
    .sort((a, b) => menuOrderNum(a) - menuOrderNum(b))
    .map((menu) => {
      if (!menu.children?.length) return menu
      return { ...menu, children: sortMenuTreeByOrderNum(menu.children) }
    })
}

export function sortMenuTree(menus: MenuVo[]): MenuVo[] {
  return sortMenuTreeByOrderNum(menus)
}

export function buildTree<T extends Record<string, unknown>>(
  items: T[],
  options: { idKey?: string; parentKey?: string; rootId?: number | string } = {},
): (T & { children?: T[] })[] {
  const idKey = options.idKey ?? 'id'
  const parentKey = options.parentKey ?? 'parentId'
  const rootId = String(options.rootId ?? 0)

  const map = new Map<string, T & { children: T[] }>()
  const roots: (T & { children?: T[] })[] = []

  for (const item of items) {
    map.set(String(item[idKey]), { ...item, children: [] })
  }

  for (const item of items) {
    const node = map.get(String(item[idKey]))!
    const parentId = String(item[parentKey] ?? rootId)
    if (parentId === rootId) {
      roots.push(node)
    } else {
      const parent = map.get(parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }

  const prune = (nodes: (T & { children?: T[] })[]) => {
    for (const node of nodes) {
      if (!node.children?.length) delete node.children
      else prune(node.children)
    }
  }
  prune(roots)
  return roots
}

export type TreeFlatRow<T> = T & { depth: number; hasChildren: boolean }

export function flattenVisibleTree<T extends { id?: number | string; children?: T[] }>(
  tree: T[],
  expanded: Set<string>,
): TreeFlatRow<T>[] {
  const rows: TreeFlatRow<T>[] = []

  const walk = (nodes: T[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = Boolean(node.children?.length)
      rows.push({ ...node, depth, hasChildren })
      if (hasChildren && expanded.has(String(node.id))) {
        walk(node.children!, depth + 1)
      }
    }
  }

  walk(tree, 0)
  return rows
}

export function sortTreeByOrderNum<T extends { orderNum?: number; children?: T[] }>(nodes: T[]): T[] {
  return [...nodes]
    .sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
    .map((node) => {
      if (!node.children?.length) return { ...node }
      return { ...node, children: sortTreeByOrderNum(node.children) }
    })
}

/** Strip empty children arrays returned by backend tree APIs. */
export function normalizeNestedTree<T extends { children?: T[] | null }>(nodes: T[]): T[] {
  return nodes.map((node) => {
    const children = node.children?.length ? normalizeNestedTree(node.children) : undefined
    if (children?.length) return { ...node, children }
    const { children: _children, ...rest } = node
    return rest as T
  })
}

type MenuSearchFields = {
  menuName?: string
  menuNameEn?: string
  menuNameJa?: string
  path?: string
  component?: string
  perms?: string
  name?: string
  routeName?: string
}

/** 菜单管理：名称/路径/权限等字段模糊匹配 */
export function menuMatchesKeyword(node: MenuSearchFields, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  const haystack = [
    node.menuName,
    node.menuNameEn,
    node.menuNameJa,
    node.path,
    node.component,
    node.perms,
    node.name,
    node.routeName,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
  return haystack.some((value) => value.includes(kw))
}

/** 菜单树搜索：命中节点保留整棵子树；仅子节点命中时保留祖先链 */
export function filterMenuTreeByKeyword<T extends MenuSearchFields & { children?: T[] }>(
  nodes: T[],
  keyword: string,
): T[] {
  const kw = keyword.trim()
  if (!kw) return nodes

  const result: T[] = []
  for (const node of nodes) {
    const selfMatch = menuMatchesKeyword(node, kw)
    const filteredChildren = node.children?.length ? filterMenuTreeByKeyword(node.children, kw) : []

    if (selfMatch) {
      result.push({ ...node })
    } else if (filteredChildren.length) {
      result.push({ ...node, children: filteredChildren })
    }
  }
  return result
}

export function collectTreeIds<T extends { id?: number | string; children?: T[] }>(tree: T[]): string[] {
  const ids: string[] = []
  const walk = (nodes: T[]) => {
    for (const node of nodes) {
      if (node.id != null) ids.push(String(node.id))
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return ids
}

export function findTreeNodeName<T extends { id?: number | string; children?: T[] }>(
  nodes: T[],
  id: string,
  nameKey: keyof T,
): string | undefined {
  for (const node of nodes) {
    if (String(node.id) === id) return String(node[nameKey] ?? '')
    if (node.children?.length) {
      const found = findTreeNodeName(node.children, id, nameKey)
      if (found) return found
    }
  }
  return undefined
}

export function expandPathToId<T extends { id?: number | string; children?: T[] }>(
  tree: T[],
  targetId: string,
): string[] {
  const path: string[] = []

  function walk(nodes: T[], ancestors: string[]): boolean {
    for (const node of nodes) {
      const id = String(node.id)
      if (id === targetId) {
        path.push(...ancestors)
        return true
      }
      if (node.children?.length && walk(node.children, [...ancestors, id])) return true
    }
    return false
  }

  walk(tree, [])
  return path
}
