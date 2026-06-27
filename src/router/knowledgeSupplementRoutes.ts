import type { RouteRecordRaw } from 'vue-router'
import type { MenuVo } from '@/types/api'

export const KNOWLEDGE_DOCUMENTS_ROUTE: RouteRecordRaw = {
  path: 'documents',
  name: 'KnowledgeDocuments',
  component: () => import('@/views/knowledge/KnowledgeDocumentManageView.vue'),
  meta: {
    titleKey: 'knowledge.docManage.title',
    perms: 'kb:document:list',
  },
}

/** 旧书签 /documents/edit/:id → 重定向 Wiki 编辑（KnowledgeDocumentEditView） */
export const KNOWLEDGE_DOCUMENT_EDIT_ROUTE: RouteRecordRaw = {
  path: 'documents/edit/:id',
  name: 'KnowledgeDocumentEdit',
  component: () => import('@/views/knowledge/KnowledgeDocumentEditView.vue'),
  meta: {
    titleKey: 'knowledge.docManage.editPageTitle',
    perms: 'kb:wiki:edit',
    skipMenuGuard: true,
  },
}

/** T14a：wiki 源文件在线编辑（写 kb/wiki* markdown 权威源，保存后需 Sync） */
export const KNOWLEDGE_WIKI_EDIT_ROUTE: RouteRecordRaw = {
  path: 'wiki/edit',
  name: 'KnowledgeWikiEdit',
  component: () => import('@/views/knowledge/KnowledgeWikiEditView.vue'),
  meta: {
    titleKey: 'knowledge.wikiEdit.pageTitle',
    perms: 'kb:wiki:edit',
    skipMenuGuard: true,
  },
}

const SUPPLEMENT_ROUTES: RouteRecordRaw[] = [
  KNOWLEDGE_DOCUMENTS_ROUTE,
  KNOWLEDGE_DOCUMENT_EDIT_ROUTE,
  KNOWLEDGE_WIKI_EDIT_ROUTE,
]

/** 后端未执行 06_knowledge_document_menu.sql 时，补全「文档管理」侧栏与路由 */
const KNOWLEDGE_DOCUMENTS_MENU: MenuVo = {
  id: 'kb-supplement-documents',
  menuName: '文档管理',
  menuNameEn: 'Documents',
  menuNameJa: '文書管理',
  name: 'KnowledgeDocuments',
  path: 'documents',
  component: 'knowledge/documents/index',
  menuType: 'C',
  icon: 'edit',
  perms: 'kb:document:list',
  orderNum: 2,
  meta: { titleKey: 'knowledge.docManage.title', icon: 'edit' },
}

function normalizeMenuPath(path?: string) {
  return (path || '').replace(/^\//, '')
}

function isKnowledgeParentMenu(menu: MenuVo) {
  const path = normalizeMenuPath(menu.path)
  return path === 'knowledge' || menu.name === 'Knowledge' || menu.routeName === 'Knowledge'
}

function hasDocumentsMenu(children: MenuVo[]) {
  return children.some((child) => {
    const path = normalizeMenuPath(child.path)
    const component = (child.component || '').replace(/\/index$/i, '')
    return (
      path === 'documents'
      || component === 'knowledge/documents'
      || child.name === 'KnowledgeDocuments'
      || child.routeName === 'KnowledgeDocuments'
    )
  })
}

function sortMenuChildren(children: MenuVo[]) {
  return [...children].sort((a, b) => (a.orderNum ?? 999) - (b.orderNum ?? 999))
}

export function mergeKnowledgeSupplementMenus(menus: MenuVo[]): MenuVo[] {
  return menus.map((menu) => {
    const children = menu.children?.length ? mergeKnowledgeSupplementMenus(menu.children) : menu.children

    if (menu.menuType === 'M' && children?.length && isKnowledgeParentMenu(menu) && !hasDocumentsMenu(children)) {
      return {
        ...menu,
        children: sortMenuChildren([...children, KNOWLEDGE_DOCUMENTS_MENU]),
      }
    }

    if (children !== menu.children) {
      return { ...menu, children }
    }

    return menu
  })
}

export function mergeKnowledgeSupplementRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    if (route.path !== 'knowledge' || !route.children?.length) return route
    const existing = new Set(route.children.map((child) => child.name))
    const missing = SUPPLEMENT_ROUTES.filter((r) => !existing.has(r.name))
    if (!missing.length) return route
    return {
      ...route,
      children: [...route.children, ...missing],
    }
  })
}

export function kbDocumentEditPath(id: string) {
  return `/knowledge/documents/edit/${id}`
}

export function kbWikiEditPath(
  slug: string,
  spaceId?: number | string,
  extra?: {
    issueId?: number | string
    issueType?: string
    issueDetail?: string
    fromCreate?: boolean
  },
) {
  const qs = new URLSearchParams({ slug })
  if (spaceId != null && spaceId !== '') qs.set('spaceId', String(spaceId))
  if (extra?.issueId != null && extra.issueId !== '') qs.set('issueId', String(extra.issueId))
  if (extra?.issueType?.trim()) qs.set('issueType', extra.issueType.trim())
  if (extra?.issueDetail?.trim()) qs.set('issueDetail', extra.issueDetail.trim())
  if (extra?.fromCreate) qs.set('fromCreate', '1')
  return `/knowledge/wiki/edit?${qs.toString()}`
}
