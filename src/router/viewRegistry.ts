import type { Component } from 'vue'

const CANDLELIGHT_DRAGON_VIEWS: Record<string, () => Promise<Component>> = {
  'CandlelightDragon/cockpit/index': () => import('@/views/CandlelightDragon/cockpit/index.vue'),
  'CandlelightDragon/bi/index': () => import('@/views/CandlelightDragon/bi/index.vue'),
  'CandlelightDragon/userportrait/index': () => import('@/views/CandlelightDragon/userportrait/index.vue'),
}

const CRM_VIEWS: Record<string, () => Promise<Component>> = {
  ...CANDLELIGHT_DRAGON_VIEWS,
  'meiling/dashboard/index': () => import('@/views/DashboardView.vue'),
  'meiling/profile/index': () => import('@/views/ProfileView.vue'),
  'meiling/settings/index': () => import('@/views/SettingsView.vue'),
  'system/user/profile/index': () => import('@/views/ProfileView.vue'),
  'meiling/analytics/index': () => import('@/views/CandlelightDragon/bi/index.vue'),
  'meiling/bi/index': () => import('@/views/CandlelightDragon/bi/index.vue'),
  'bi/analysis/index': () => import('@/views/CandlelightDragon/bi/index.vue'),
  'bi/analytics/index': () => import('@/views/CandlelightDragon/bi/index.vue'),
  'analysis/bi/index': () => import('@/views/CandlelightDragon/bi/index.vue'),
  'meiling/pulse/index': () => import('@/views/PulseView.vue'),
  'meiling/workflows/index': () => import('@/views/WorkflowView.vue'),
  'meiling/reports/index': () => import('@/views/ReportsView.vue'),
  'meiling/persona/index': () => import('@/views/CandlelightDragon/userportrait/index.vue'),
  'persona/index': () => import('@/views/CandlelightDragon/userportrait/index.vue'),
  'bi/persona/index': () => import('@/views/CandlelightDragon/userportrait/index.vue'),
  'user/persona/index': () => import('@/views/CandlelightDragon/userportrait/index.vue'),
  'system/menu/index': () => import('@/views/system/MenuManageView.vue'),
  'system/action/index': () => import('@/views/system/ActionManageView.vue'),
  'system/user/index': () => import('@/views/system/UserManageView.vue'),
  'system/role/index': () => import('@/views/system/RoleManageView.vue'),
  'system/post/index': () => import('@/views/system/PostManageView.vue'),
  'system/dept/index': () => import('@/views/system/DeptManageView.vue'),
  'system/dict/index': () => import('@/views/system/DictManageView.vue'),
  'system/kb-llm/index': () => import('@/views/system/kb-llm/index.vue'),
  'knowledge/kb-llm/index': () => import('@/views/system/kb-llm/index.vue'),
  'system/operlog/index': () => import('@/views/system/OperLogManageView.vue'),
  'system/loginlog/index': () => import('@/views/system/LoginLogManageView.vue'),
  'system/system/index': () => import('@/views/system/SystemManageView.vue'),
  'system/system-user/index': () => import('@/views/system/SystemUserAssignView.vue'),
  'operation/project/index': () => import('@/views/operation/ProjectManageView.vue'),
  'operation/server/index': () => import('@/views/operation/ServerManageView.vue'),
  'operation/platform/index': () => import('@/views/operation/PlatformManageView.vue'),
  'operation/component/index': () => import('@/views/operation/ComponentManageView.vue'),
  // 企业知识库：作为茉莉后台菜单模块，菜单在「菜单管理」维护、由 getRouters 下发到左侧菜单树
  'knowledge/browse/index': () => import('@/views/knowledge/KnowledgeBrowseView.vue'),
  'knowledge/ask/index': () => import('@/views/knowledge/KnowledgeAskView.vue'),
  'knowledge/graph/index': () => import('@/views/knowledge/KnowledgeGraphView.vue'),
  'knowledge/lint/index': () => import('@/views/knowledge/KnowledgeLintView.vue'),
  'knowledge/ingest/index': () => import('@/views/knowledge/KnowledgeIngestWorkbenchView.vue'),
  'knowledge/wiki-govern/index': () => import('@/views/knowledge/KnowledgeWikiGovernView.vue'),
  'knowledge/wiki/govern/index': () => import('@/views/knowledge/KnowledgeWikiGovernView.vue'),
  'knowledge/spaces/index': () => import('@/views/knowledge/KnowledgeSpaceManageView.vue'),
  'knowledge/documents/index': () => import('@/views/knowledge/KnowledgeDocumentManageView.vue'),
  'knowledge/documents/edit': () => import('@/views/knowledge/KnowledgeDocumentEditView.vue'),
  // 兼容别名
  'knowledge/index/index': () => import('@/views/knowledge/KnowledgeBrowseView.vue'),
  'knowledge/docs/index': () => import('@/views/knowledge/KnowledgeBrowseView.vue'),
  'knowledge/query/index': () => import('@/views/knowledge/KnowledgeAskView.vue'),
  'knowledge/health/index': () => import('@/views/knowledge/KnowledgeLintView.vue'),
}

const viewModules = import.meta.glob('@/views/**/*.vue')

export function resolveViewComponent(component: string) {
  if (CRM_VIEWS[component]) {
    return CRM_VIEWS[component]
  }

  const viewPath = `/src/views/${component}.vue`
  if (viewModules[viewPath]) {
    return viewModules[viewPath] as () => Promise<Component>
  }

  return () => import('@/views/PlaceholderView.vue')
}
