import type { Component } from 'vue'
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  Workflow,
  Sparkles,
  Building2,
  FileBarChart,
  MessageSquare,
  Server,
  Circle,
  BookOpen,
  Briefcase,
  Menu,
  Lock,
  Wrench,
  Monitor,
  List,
  Library,
  Share2,
  MessageCircleQuestion,
  Activity,
  Hammer,
  Lightbulb,
  Puzzle,
} from 'lucide-vue-next'

const ICON_MAP: Record<string, Component> = {
  dashboard: LayoutDashboard,
  system: Settings,
  user: Users,
  peoples: Users,
  chart: BarChart3,
  guide: Workflow,
  message: MessageSquare,
  server: Server,
  tree: Building2,
  'tree-table': FileBarChart,
  documentation: FileBarChart,
  sparkles: Sparkles,
  settings: Settings,
  edit: Settings,
  post: Briefcase,
  dict: BookOpen,
  menu: Menu,
  lock: Lock,
  tool: Wrench,
  monitor: Monitor,
  list: List,
  knowledge: Library,
  query: MessageCircleQuestion,
  graph: Share2,
  health: Activity,
  build: Hammer,
  example: Lightbulb,
  component: Puzzle,
}

export type MenuIconKey = keyof typeof ICON_MAP

/** 菜单表单可选图标（新增图标加入 ICON_MAP 即可自动出现在选择器） */
export const MENU_ICON_OPTIONS = Object.keys(ICON_MAP).sort() as MenuIconKey[]

export function resolveMenuIcon(icon?: string | null): Component {
  if (!icon) return Circle
  return ICON_MAP[icon] || Circle
}

export function getMenuIconLabel(key: string | undefined | null, t: (i18nKey: string) => string): string {
  if (!key) return t('system.menu.iconNone')
  const i18nKey = `system.menu.iconLabels.${key}`
  const label = t(i18nKey)
  return label === i18nKey ? key : label
}

export function matchMenuIconQuery(key: string, query: string, t: (i18nKey: string) => string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (key.toLowerCase().includes(q)) return true
  return getMenuIconLabel(key, t).toLowerCase().includes(q)
}
