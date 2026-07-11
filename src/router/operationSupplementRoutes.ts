import type { RouteRecordRaw } from 'vue-router'
import type { MenuVo } from '@/types/api'

/** SVR-21d：端口矩阵管理（菜单 406） */
export const OPERATION_PORT_MATRIX_ROUTE: RouteRecordRaw = {
  path: 'port-matrix',
  name: 'OperationPortMatrix',
  component: () => import('@/views/operation/PortMatrixManageView.vue'),
  meta: {
    titleKey: 'operation.portMatrix.title',
    perms: 'operation:port-matrix:list',
  },
}

/** 任务历史（无独立菜单种子时，可由部署中心跳转） */
export const OPERATION_TASK_HISTORY_ROUTE: RouteRecordRaw = {
  path: 'task',
  name: 'OperationTaskHistory',
  component: () => import('@/views/operation/TaskHistoryView.vue'),
  meta: {
    titleKey: 'operation.taskHistory.title',
    perms: 'operation:server:list',
  },
}

const SUPPLEMENT_ROUTES: RouteRecordRaw[] = [
  OPERATION_PORT_MATRIX_ROUTE,
  OPERATION_TASK_HISTORY_ROUTE,
]

const OPERATION_PORT_MATRIX_MENU: MenuVo = {
  id: 'op-supplement-port-matrix',
  menuName: '端口矩阵',
  menuNameEn: 'Port Matrix',
  menuNameJa: 'ポートマトリクス',
  name: 'OperationPortMatrix',
  path: 'port-matrix',
  component: 'operation/port-matrix/index',
  menuType: 'C',
  icon: 'table',
  perms: 'operation:port-matrix:list',
  orderNum: 6,
  meta: { titleKey: 'operation.portMatrix.title', icon: 'table' },
}

const OPERATION_TASK_HISTORY_MENU: MenuVo = {
  id: 'op-supplement-task-history',
  menuName: '任务历史',
  menuNameEn: 'Task History',
  menuNameJa: 'タスク履歴',
  name: 'OperationTaskHistory',
  path: 'task',
  component: 'operation/task/index',
  menuType: 'C',
  icon: 'log',
  perms: 'operation:server:list',
  orderNum: 7,
  meta: { titleKey: 'operation.taskHistory.title', icon: 'log' },
}

function normalizeMenuPath(path?: string) {
  return (path || '').replace(/^\//, '')
}

function isOperationParentMenu(menu: MenuVo) {
  const path = normalizeMenuPath(menu.path)
  return path === 'operation' || menu.name === 'Operation' || menu.routeName === 'Operation'
}

function hasPortMatrixMenu(children: MenuVo[]) {
  return children.some((child) => {
    const path = normalizeMenuPath(child.path)
    const component = (child.component || '').replace(/\/index$/i, '')
    return (
      path === 'port-matrix'
      || component === 'operation/port-matrix'
      || child.name === 'OperationPortMatrix'
      || child.routeName === 'OperationPortMatrix'
    )
  })
}

function hasTaskHistoryMenu(children: MenuVo[]) {
  return children.some((child) => {
    const path = normalizeMenuPath(child.path)
    const component = (child.component || '').replace(/\/index$/i, '')
    return (
      path === 'task'
      || component === 'operation/task'
      || child.name === 'OperationTaskHistory'
      || child.routeName === 'OperationTaskHistory'
    )
  })
}

function sortMenuChildren(children: MenuVo[]) {
  return [...children].sort((a, b) => (a.orderNum ?? 999) - (b.orderNum ?? 999))
}

export function mergeOperationSupplementMenus(menus: MenuVo[]): MenuVo[] {
  return menus.map((menu) => {
    const children = menu.children?.length ? mergeOperationSupplementMenus(menu.children) : menu.children

    if (menu.menuType === 'M' && children?.length && isOperationParentMenu(menu)) {
      const extras: MenuVo[] = []
      if (!hasPortMatrixMenu(children)) extras.push(OPERATION_PORT_MATRIX_MENU)
      if (!hasTaskHistoryMenu(children)) extras.push(OPERATION_TASK_HISTORY_MENU)
      if (extras.length) {
        return {
          ...menu,
          children: sortMenuChildren([...children, ...extras]),
        }
      }
    }

    if (children !== menu.children) {
      return { ...menu, children }
    }

    return menu
  })
}

export function mergeOperationSupplementRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    if (route.path !== 'operation' || !route.children?.length) return route
    const existing = new Set(route.children.map((child) => child.name))
    const missing = SUPPLEMENT_ROUTES.filter((r) => !existing.has(r.name))
    if (!missing.length) return route
    return {
      ...route,
      children: [...route.children, ...missing],
    }
  })
}
