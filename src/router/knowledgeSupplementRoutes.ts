import type { RouteRecordRaw } from 'vue-router'

export const KNOWLEDGE_DOCUMENT_EDIT_ROUTE: RouteRecordRaw = {
  path: 'documents/edit/:id',
  name: 'KnowledgeDocumentEdit',
  component: () => import('@/views/knowledge/KnowledgeDocumentEditView.vue'),
  meta: {
    titleKey: 'knowledge.docManage.editPageTitle',
    perms: 'kb:document:edit',
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
  },
}

const SUPPLEMENT_ROUTES: RouteRecordRaw[] = [
  KNOWLEDGE_DOCUMENT_EDIT_ROUTE,
  KNOWLEDGE_WIKI_EDIT_ROUTE,
]

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
  },
) {
  const qs = new URLSearchParams({ slug })
  if (spaceId != null && spaceId !== '') qs.set('spaceId', String(spaceId))
  if (extra?.issueId != null && extra.issueId !== '') qs.set('issueId', String(extra.issueId))
  if (extra?.issueType?.trim()) qs.set('issueType', extra.issueType.trim())
  if (extra?.issueDetail?.trim()) qs.set('issueDetail', extra.issueDetail.trim())
  return `/knowledge/wiki/edit?${qs.toString()}`
}
