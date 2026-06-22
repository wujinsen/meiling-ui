import type { RouteRecordRaw } from 'vue-router'

/** 不依赖后端菜单、所有登录用户均可访问的路由 */
export const STATIC_ROUTE_NAMES = new Set([
  'Dashboard',
  'profile',
  'settings',
  'KnowledgeBrowse',
  'KnowledgeAsk',
  'KnowledgeGraph',
  'KnowledgeLint',
])

export const staticAppRoutes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { titleKey: 'nav.dashboard' },
  },
  {
    path: 'profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { titleKey: 'profile.title' },
  },
  {
    path: 'settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'nav.settings' },
  },
  // 企业知识库（前端内置，后续可由茉莉后台菜单管理接管，同 path 自动去重）
  {
    path: 'knowledge/browse',
    name: 'KnowledgeBrowse',
    component: () => import('@/views/knowledge/KnowledgeBrowseView.vue'),
    meta: { titleKey: 'knowledge.browse.title' },
  },
  {
    path: 'knowledge/ask',
    name: 'KnowledgeAsk',
    component: () => import('@/views/knowledge/KnowledgeAskView.vue'),
    meta: { titleKey: 'knowledge.ask.title' },
  },
  {
    path: 'knowledge/graph',
    name: 'KnowledgeGraph',
    component: () => import('@/views/knowledge/KnowledgeGraphView.vue'),
    meta: { titleKey: 'knowledge.graph.title' },
  },
  {
    path: 'knowledge/lint',
    name: 'KnowledgeLint',
    component: () => import('@/views/knowledge/KnowledgeLintView.vue'),
    meta: { titleKey: 'knowledge.lint.title' },
  },
]
