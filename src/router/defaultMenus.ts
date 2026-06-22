import type { MenuVo } from '@/types/api'

const dashboardMenu: MenuVo = {
  id: 'meiling-dashboard',
  menuName: '工作台',
  name: 'Dashboard',
  parentId: 0,
  path: '/',
  component: 'meiling/dashboard/index',
  menuType: 'C',
  icon: 'dashboard',
  hidden: false,
  meta: { titleKey: 'nav.dashboard', icon: 'dashboard' },
}

const settingsMenu: MenuVo = {
  id: 'meiling-settings',
  menuName: '设置',
  name: 'Settings',
  parentId: 0,
  path: 'settings',
  component: 'meiling/settings/index',
  menuType: 'C',
  icon: 'settings',
  hidden: false,
  meta: { titleKey: 'nav.settings', icon: 'settings' },
}

/** 无后端时的兜底菜单（结构与 sys_menu 700–703 一致） */
const insightMenu: MenuVo = {
  id: 700,
  menuName: '洞察与控制',
  menuNameEn: 'Insight & Control',
  menuNameJa: '洞察と制御',
  name: 'Insight',
  parentId: 0,
  path: 'insight',
  component: 'Layout',
  menuType: 'M',
  icon: 'chart',
  hidden: false,
  meta: { titleKey: 'sections.insightControl', icon: 'chart' },
  children: [
    {
      id: 701,
      menuName: '报表',
      menuNameEn: 'Reports',
      menuNameJa: 'レポート',
      name: 'Reports',
      parentId: 700,
      path: 'reports',
      component: 'meiling/reports/index',
      menuType: 'C',
      icon: 'documentation',
      hidden: false,
      meta: { titleKey: 'reports.title', icon: 'documentation' },
    },
    {
      id: 702,
      menuName: 'Pulse',
      menuNameEn: 'Pulse',
      menuNameJa: 'Pulse',
      name: 'Pulse',
      parentId: 700,
      path: 'pulse',
      component: 'meiling/pulse/index',
      menuType: 'C',
      icon: 'message',
      hidden: false,
      meta: { titleKey: 'nav.pulse', icon: 'message' },
    },
    {
      id: 703,
      menuName: '工作流',
      menuNameEn: 'Workflows',
      menuNameJa: 'ワークフロー',
      name: 'Workflows',
      parentId: 700,
      path: 'workflows',
      component: 'meiling/workflows/index',
      menuType: 'C',
      icon: 'guide',
      hidden: false,
      meta: { titleKey: 'nav.workflows', icon: 'guide' },
    },
  ],
}

/** 企业知识库（前端内置模块，后续可由茉莉后台菜单管理接管；同 path=knowledge 自动去重） */
const knowledgeMenu: MenuVo = {
  id: 'meiling-knowledge',
  menuName: '企业知识库',
  menuNameEn: 'Knowledge Base',
  menuNameJa: 'ナレッジベース',
  name: 'Knowledge',
  parentId: 0,
  path: 'knowledge',
  component: 'Layout',
  menuType: 'M',
  icon: 'knowledge',
  hidden: false,
  meta: { titleKey: 'knowledge.title', icon: 'knowledge' },
  children: [
    {
      id: 'meiling-knowledge-browse',
      menuName: '文档浏览',
      menuNameEn: 'Browse',
      menuNameJa: 'ドキュメント',
      name: 'KnowledgeBrowse',
      parentId: 'meiling-knowledge',
      path: 'browse',
      component: 'knowledge/browse/index',
      menuType: 'C',
      icon: 'documentation',
      hidden: false,
      meta: { titleKey: 'knowledge.browse.title', icon: 'documentation' },
    },
    {
      id: 'meiling-knowledge-ask',
      menuName: '智能问答',
      menuNameEn: 'Ask',
      menuNameJa: 'Q&A',
      name: 'KnowledgeAsk',
      parentId: 'meiling-knowledge',
      path: 'ask',
      component: 'knowledge/ask/index',
      menuType: 'C',
      icon: 'query',
      hidden: false,
      meta: { titleKey: 'knowledge.ask.title', icon: 'query' },
    },
    {
      id: 'meiling-knowledge-graph',
      menuName: '关系图谱',
      menuNameEn: 'Graph',
      menuNameJa: 'グラフ',
      name: 'KnowledgeGraph',
      parentId: 'meiling-knowledge',
      path: 'graph',
      component: 'knowledge/graph/index',
      menuType: 'C',
      icon: 'graph',
      hidden: false,
      meta: { titleKey: 'knowledge.graph.title', icon: 'graph' },
    },
    {
      id: 'meiling-knowledge-lint',
      menuName: '健康体检',
      menuNameEn: 'Health',
      menuNameJa: 'ヘルス',
      name: 'KnowledgeLint',
      parentId: 'meiling-knowledge',
      path: 'lint',
      component: 'knowledge/lint/index',
      menuType: 'C',
      icon: 'health',
      hidden: false,
      meta: { titleKey: 'knowledge.lint.title', icon: 'health' },
    },
  ],
}

/** 美玲业务侧栏菜单（后端不可用时兜底） */
export function getDefaultMenus(): MenuVo[] {
  return [dashboardMenu, insightMenu, knowledgeMenu, settingsMenu]
}

function normalizeMenuPath(path?: string) {
  return (path || '').replace(/^\//, '')
}

function hasMenuPath(menus: MenuVo[], path: string): boolean {
  for (const menu of menus) {
    if (normalizeMenuPath(menu.path) === path) return true
    if (menu.children?.length && hasMenuPath(menu.children, path)) return true
  }
  return false
}

function hasFrontendMenu(menus: MenuVo[], extra: MenuVo): boolean {
  if (extra.name === 'Dashboard' || extra.component === 'meiling/dashboard/index') {
    return menus.some(
      (menu) =>
        menu.name === 'Dashboard' ||
        menu.component === 'meiling/dashboard/index' ||
        normalizeMenuPath(menu.path) === '',
    )
  }
  const path = normalizeMenuPath(extra.path)
  return path ? hasMenuPath(menus, path) : false
}

/** 前端内置、后端菜单通常不包含的侧栏项（工作台置顶，知识库 + 设置在末尾） */
const frontendSidebarMenus: MenuVo[] = [dashboardMenu, knowledgeMenu, settingsMenu]

/** 侧栏：工作台置顶 + 后端菜单 + 设置（去重） */
export function mergeSidebarMenus(backendMenus: MenuVo[]): MenuVo[] {
  const merged = [...backendMenus]
  const prepend: MenuVo[] = []
  const append: MenuVo[] = []

  for (const extra of frontendSidebarMenus) {
    if (hasFrontendMenu(merged, extra)) continue
    if (extra.name === 'Dashboard') prepend.push(extra)
    else append.push(extra)
  }

  return [...prepend, ...merged, ...append]
}

/** 已由 staticRoutes 注册的路由，动态菜单里跳过避免重复 */
export const frontendStaticMenuPaths = new Set(['', 'profile', 'settings', 'knowledge'])

export function excludeStaticMenuRoutes(menus: MenuVo[]): MenuVo[] {
  return menus.filter((menu) => !frontendStaticMenuPaths.has(normalizeMenuPath(menu.path)))
}
