import type { MenuVo } from '@/types/api'

type MenuMeta = MenuVo['meta'] & { titleKey?: string }
type LocalizedMenu = MenuVo & { menuNameEn?: string; menuNameJa?: string }

const MENU_COMPONENT_TITLE_KEYS: Record<string, string> = {
  'meiling/dashboard/index': 'nav.dashboard',
  'meiling/reports/index': 'reports.title',
  'meiling/pulse/index': 'nav.pulse',
  'meiling/workflows/index': 'nav.workflows',
  'meiling/analytics/index': 'nav.analytics',
  'meiling/bi/index': 'nav.analytics',
  'bi/analysis/index': 'nav.analytics',
  'bi/analytics/index': 'nav.analytics',
  'analysis/bi/index': 'nav.analytics',
  'CandlelightDragon/bi/index': 'nav.analytics',
  'CandlelightDragon/cockpit/index': 'cockpit.title',
  'meiling/persona/index': 'persona.title',
  'CandlelightDragon/userportrait/index': 'persona.title',
  'persona/index': 'persona.title',
  'bi/persona/index': 'persona.title',
  'user/persona/index': 'persona.title',
  'system/menu/index': 'menu.navMenu',
  'system/user/index': 'menu.navUser',
  'system/role/index': 'menu.navRole',
  'system/post/index': 'menu.navPost',
  'system/dept/index': 'menu.navDept',
  'system/dict/index': 'menu.navDict',
  'system/action/index': 'system.action.catalog',
  'system/operlog/index': 'menu.navOperlog',
  'system/loginlog/index': 'menu.navLoginlog',
  'system/system/index': 'system.manage.title',
  'system/system-user/index': 'system.userAssign.title',
  'operation/project/index': 'operation.project.title',
  'operation/server/index': 'operation.server.title',
  'operation/platform/index': 'operation.platform.title',
  'operation/component/index': 'operation.component.title',
  'knowledge/browse/index': 'knowledge.browse.title',
  'knowledge/index/index': 'knowledge.browse.title',
  'knowledge/docs/index': 'knowledge.browse.title',
  'knowledge/ask/index': 'knowledge.ask.title',
  'knowledge/query/index': 'knowledge.ask.title',
  'knowledge/graph/index': 'knowledge.graph.title',
  'knowledge/lint/index': 'knowledge.lint.title',
  'knowledge/health/index': 'knowledge.lint.title',
  'knowledge/ingest/index': 'knowledge.ingest.title',
  'knowledge/documents/index': 'knowledge.docManage.title',
  'knowledge/documents/edit': 'knowledge.docManage.editPageTitle',
}

const MENU_PATH_TITLE_KEYS: Record<string, string> = {
  system: 'sections.system',
  operation: 'menu.navOperation',
  monitor: 'menu.navOperation',
  insight: 'sections.insightControl',
  candlelight: 'candlelightDragon.title',
  knowledge: 'knowledge.title',
}

const MENU_NAME_TITLE_KEYS: Record<string, string> = {
  工作台: 'nav.dashboard',
  仪表盘: 'nav.dashboard',
  洞察与控制: 'sections.insightControl',
  报表: 'reports.title',
  工作流: 'nav.workflows',
  系统管理: 'sections.system',
  系统: 'sections.system',
  用户管理: 'menu.navUser',
  角色管理: 'menu.navRole',
  菜单管理: 'menu.navMenu',
  部门管理: 'menu.navDept',
  岗位管理: 'menu.navPost',
  字典管理: 'menu.navDict',
  系统注册: 'system.manage.title',
  系统用户分配: 'system.userAssign.title',
  分配系统: 'system.userAssign.title',
  运维管理: 'menu.navOperation',
  项目管理: 'operation.project.title',
  服务器管理: 'operation.server.title',
  平台管理: 'operation.platform.title',
  组件管理: 'operation.component.title',
  动作目录: 'system.action.catalog',
  操作日志: 'menu.navOperlog',
  登录日志: 'menu.navLoginlog',
  数据驾驶舱: 'cockpit.title',
  数据分析: 'nav.analytics',
  用户画像: 'persona.title',
}

function normalizeComponent(component?: string) {
  return component?.replace(/^\/+/, '').replace(/\.vue$/i, '') ?? ''
}

function pickLocalizedName(menu: LocalizedMenu, locale: string) {
  if (locale.startsWith('en') && menu.menuNameEn?.trim()) return menu.menuNameEn.trim()
  if (locale.startsWith('ja') && menu.menuNameJa?.trim()) return menu.menuNameJa.trim()
  if (locale.startsWith('zh') && menu.menuName?.trim()) return menu.menuName.trim()
  return undefined
}

export function resolveTitleKey(menu: MenuVo) {
  const meta = menu.meta as MenuMeta | undefined
  if (meta?.titleKey) return meta.titleKey

  const component = normalizeComponent(menu.component)
  if (component && MENU_COMPONENT_TITLE_KEYS[component]) {
    return MENU_COMPONENT_TITLE_KEYS[component]
  }

  const path = (menu.path || '').replace(/^\/+/, '').split('/')[0]
  if (path && MENU_PATH_TITLE_KEYS[path]) {
    return MENU_PATH_TITLE_KEYS[path]
  }

  if (menu.menuName && MENU_NAME_TITLE_KEYS[menu.menuName]) {
    return MENU_NAME_TITLE_KEYS[menu.menuName]
  }

  return undefined
}

export function resolveMenuLabel(
  menu: MenuVo,
  t: (key: string) => string,
  locale: string,
) {
  const localized = pickLocalizedName(menu, locale)
  if (localized) return localized

  const titleKey = resolveTitleKey(menu)
  if (titleKey) return t(titleKey)

  const meta = menu.meta as MenuMeta | undefined
  return meta?.title || menu.menuName || menu.name || ''
}
