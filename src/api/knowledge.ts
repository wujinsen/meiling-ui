import { request } from '@/api/http'
import { kbAttachmentUploadTimeoutMs } from '@/constants/knowledge'
import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type {
  KbAccessibleSpace,
  KbAskRequest,
  KbAskResponse,
  KbAttachment,
  KbCategoryTree,
  KbCategorySaveRequest,
  KbDocumentDetail,
  KbDocumentListItem,
  KbDocumentSearchParams,
  KbGraph,
  KbGraphEgoParams,
  KbGraphNode,
  KbGraphParams,
  KbIndex,
  KbLintIssue,
  KbLintIssueStatus,
  KbLintReport,
  KbPage,
  KbQaHistory,
  KbSyncLog,
  KbSyncStatus,
  KbSyncTrigger,
  KbTag,
  KbTagSaveRequest,
  KbWikiPage,
  KbWikiSaveRequest,
  KbWikiSaveResult,
  KbWikiAiReviseRequest,
  KbWikiAiReviseResult,
  KbWikiLintPreviewRequest,
  KbWikiLintPreview,
  KbWikiSpaceLintRequest,
  KbWikiSpaceLintResult,
  KbWikiGovernOptions,
  KbWikiEnrichRequest,
  KbWikiEnrichResult,
  KbRawTreeNode,
  KbRawCoverage,
  KbRawCoverageFilter,
  KbIngestJob,
  KbIngestJobCreateRequest,
  KbIngestPlanUpdateRequest,
  KbIngestDraft,
  KbIngestGenerateResult,
  KbIngestLint,
  KbIngestCommitResult,
  KbIngestPrepareResult,
  KbIngestPublishResult,
  KbIngestExpressStartResult,
  KbIngestTemplate,
  KbIngestTemplateCreateRequest,
  KbIngestJobFromTemplateRequest,
  KbIngestSaveAsTemplateRequest,
  MoliPage,
} from '@/types/knowledge'
import { getToken } from '@/utils/authSession'
import { buildEntityQuery, jsonEntityBody, toEntityId } from '@/utils/id'

/**
 * 网关前缀：网关 StripPrefix=1 去掉 /KnowledgeServer 后转发到 moli-knowledge-server。
 * 契约见 moli-project-distribute/docs/KNOWLEDGE_API.md
 */
const KB_BASE = '/KnowledgeServer/kb'

/** 后端未就绪时使用本地 Mock；联调时设 VITE_USE_MOCK_KNOWLEDGE=false */
const USE_MOCK = import.meta.env.VITE_USE_MOCK_KNOWLEDGE === 'true'

export function isMockKnowledgeEnabled() {
  return USE_MOCK
}

function buildKbDocumentSearchQuery(params: KbDocumentSearchParams) {
  const qs = new URLSearchParams()
  if (params.spaceId != null && params.spaceId !== '') qs.set('spaceId', String(params.spaceId))
  for (const sid of params.spaceIds ?? []) {
    if (sid != null && sid !== '') qs.append('spaceIds', String(sid))
  }
  if (params.categoryId != null) qs.set('categoryId', String(params.categoryId))
  if (params.keyword?.trim()) qs.set('keyword', params.keyword.trim())
  if (params.status !== undefined && params.status !== '') qs.set('status', String(params.status))
  if (params.tagId != null) qs.set('tagId', String(params.tagId))
  if (params.source?.trim()) qs.set('source', params.source.trim())
  if (params.pageNum != null) qs.set('pageNum', String(params.pageNum))
  if (params.pageSize != null) qs.set('pageSize', String(params.pageSize))
  const query = qs.toString()
  return query ? `?${query}` : ''
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  return buildEntityQuery(params)
}

function mockPageToDetail(p: KbPage): KbDocumentDetail {
  return {
    id: p.docId,
    spaceId: p.spaceId ?? 900000000000000001,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    content: p.content,
    kbType: p.kbType,
    domain: p.domain,
    source: 'kb',
    docType: 'markdown',
    status: (p.status ?? 1) as import('@/types/knowledge').KbDocStatus,
    versionNo: 1,
  }
}

function mockPageToListItem(p: KbPage): KbDocumentListItem {
  return {
    id: p.docId,
    spaceId: p.spaceId ?? 900000000000000001,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    kbType: p.kbType,
    domain: p.domain,
    source: 'kb',
    status: (p.status ?? 1) as import('@/types/knowledge').KbDocStatus,
    versionNo: 1,
    updateTime: p.updateTime,
  }
}

const MOCK_CATEGORY_TREE: KbCategoryTree[] = [
  {
    id: 900000000000000101,
    spaceId: 900000000000000001,
    parentId: 0,
    categoryName: '技术文档',
    sort: 1,
    children: [
      {
        id: 900000000000000103,
        spaceId: 900000000000000001,
        parentId: 900000000000000101,
        categoryName: '后端服务',
        sort: 1,
        children: [],
      },
    ],
  },
  {
    id: 900000000000000102,
    spaceId: 900000000000000001,
    parentId: 0,
    categoryName: '产品规范',
    sort: 2,
    children: [],
  },
]

const MOCK_TAGS: KbTag[] = [
  { id: 900001, spaceId: 900000000000000001, tagName: '部署', color: '#6366f1' },
  { id: 900002, spaceId: 900000000000000001, tagName: '入门', color: '#10b981' },
  { id: 900003, spaceId: 900000000000000001, tagName: '微服务', color: '#f59e0b' },
  { id: 900004, spaceId: 900000000000000001, tagName: '权限', color: '#ef4444' },
]

let mockCategoryTreeState: KbCategoryTree[] = JSON.parse(JSON.stringify(MOCK_CATEGORY_TREE)) as KbCategoryTree[]
let mockTagsState: KbTag[] = [...MOCK_TAGS]
let mockCategorySeq = 91000
let mockTagSeq = 92000

function walkCategoryTree(nodes: KbCategoryTree[], fn: (node: KbCategoryTree, parent: KbCategoryTree[] | null, index: number) => boolean) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]
    if (fn(node, nodes, i)) return true
    if (node.children?.length && walkCategoryTree(node.children, fn)) return true
  }
  return false
}

function appendMockCategory(parentId: string, node: KbCategoryTree) {
  if (parentId === '0') {
    mockCategoryTreeState.push(node)
    return
  }
  walkCategoryTree(mockCategoryTreeState, (item) => {
    if (String(item.id) === parentId) {
      item.children = [...(item.children ?? []), node]
      return true
    }
    return false
  })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ok<T>(data: T): MoliResult<T> {
  return { code: API_SUCCESS_CODE, msg: '成功', data }
}

// ---------------------------------------------------------------------------
// Mock 数据（结构与 KNOWLEDGE_API.md 一致，仅离线演示用）
// ---------------------------------------------------------------------------

const MOCK_PAGES: KbPage[] = [
  {
    docId: 90001,
    slug: 'guides/本地启动指南',
    title: '本地启动指南',
    summary: '从零搭建本地开发环境并启动各微服务。',
    kbType: 'guide',
    domain: 'OPS',
    status: 1,
    updateTime: '2026-06-22 14:00:00',
    tags: ['部署', '入门'],
    content:
      '# 本地启动指南\n\n## 前置\n- JDK 17、MySQL 8、Node 18\n\n## 步骤\n1. 启动网关（21000）\n2. 启动用户中心（8888）\n3. 启动知识库服务（8090）\n\n相关：[[services/用户中心]]',
    outLinks: [{ docId: 90010, slug: 'services/用户中心', title: '用户中心', relationType: 'links_to' }],
    backLinks: [],
  },
  {
    docId: 90010,
    slug: 'services/用户中心',
    title: '用户中心',
    summary: '统一登录、令牌签发与权限同步的核心服务。',
    kbType: 'service',
    domain: 'AP',
    status: 1,
    updateTime: '2026-06-22 14:00:00',
    tags: ['微服务', '权限'],
    content:
      '# 用户中心\n\n负责 SSO 登录、令牌校验与多系统门户。\n\n- 令牌即 Shiro SessionId\n- 权限模型见 [[concepts/rbac-权限模型]]',
    outLinks: [{ docId: 90011, slug: 'concepts/rbac-权限模型', title: 'RBAC 权限模型', relationType: 'related' }],
    backLinks: [{ docId: 90001, slug: 'guides/本地启动指南', title: '本地启动指南', relationType: 'links_to' }],
  },
  {
    docId: 90011,
    slug: 'concepts/rbac-权限模型',
    title: 'RBAC 权限模型',
    summary: '基于角色的访问控制：用户-角色-权限三层模型。',
    kbType: 'concept',
    domain: 'AP',
    status: 1,
    updateTime: '2026-06-20 09:00:00',
    tags: ['权限', '概念'],
    content: '# RBAC 权限模型\n\n用户绑定角色，角色绑定权限码（perms），接口按 perms 鉴权。',
    outLinks: [],
    backLinks: [{ docId: 90010, slug: 'services/用户中心', title: '用户中心', relationType: 'related' }],
  },
  {
    docId: 90020,
    slug: 'interview/spring-事务',
    title: 'Spring 事务（面试题系列）',
    summary: 'Spring 事务传播行为与失效场景。',
    kbType: 'interview',
    domain: 'BE',
    status: 1,
    updateTime: '2026-06-19 11:00:00',
    tags: ['Spring', '面试'],
    content:
      '# Spring 事务\n\n## 失效场景\n- 方法非 public\n- 同类内部调用（自调用）\n- 异常被捕获未抛出\n- 数据库引擎不支持事务',
    outLinks: [],
    backLinks: [],
  },
]

const MOCK_INDEX: KbIndex = {
  total: MOCK_PAGES.length,
  groups: [
    {
      type: 'guide',
      label: '操作指导',
      count: MOCK_PAGES.filter((p) => p.kbType === 'guide').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'guide').map(toIndexItem),
    },
    {
      type: 'service',
      label: '微服务',
      count: MOCK_PAGES.filter((p) => p.kbType === 'service').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'service').map(toIndexItem),
    },
    {
      type: 'concept',
      label: '概念',
      count: MOCK_PAGES.filter((p) => p.kbType === 'concept').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'concept').map(toIndexItem),
    },
    {
      type: 'interview',
      label: '面试题',
      count: MOCK_PAGES.filter((p) => p.kbType === 'interview').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'interview').map(toIndexItem),
    },
  ],
}

function mockIndexMeta(): KbIndex {
  return {
    total: MOCK_INDEX.total,
    groups: MOCK_INDEX.groups.map((g) => ({
      type: g.type,
      label: g.label,
      count: g.count ?? g.items.length,
      items: [],
    })),
  }
}

function toIndexItem(p: KbPage) {
  return { id: p.docId, slug: p.slug, title: p.title, summary: p.summary }
}

function mockGraph(params: KbGraphParams = {}): KbGraph {
  const types = ['guide', 'service', 'concept', 'article', 'interview', 'output']
  const relations = ['links_to', 'related', 'same_tag', 'depends_on', 'ref', 'contradiction', 'inference']
  const titles = [
    '用户中心', 'RBAC 权限模型', '本地启动指南', 'Spring 事务', '网关路由', '鉴权流程',
    '知识库索引', '向量检索', '问答编排', '体检规则', '断链扫描', '孤儿页清理',
    '缓存设计', '分库分表', '消息队列', '幂等设计', '限流降级', '链路追踪',
    '配置中心', '灰度发布', '单点登录', '令牌刷新', 'OpenAPI 规范', 'Webhook 回调',
    '审计日志', '数据脱敏', '租户隔离', '组织架构', '岗位权限', '菜单管理',
    '工作流引擎', '定时任务', '文件存储', '图谱构建', '实体抽取', '关系推断',
    '冲突检测', '版本回滚', '导入导出', '搜索高亮',
  ]
  const allNodes: KbGraphNode[] = titles.map((title, i) => ({
    id: String(90000 + i),
    title,
    type: types[i % types.length],
    deg: 0,
  }))

  const allLinks: KbGraph['links'] = []
  const deg = new Array(allNodes.length).fill(0)
  // 每个节点向前若干个节点连边，构造一张中等密度的图
  for (let i = 1; i < allNodes.length; i++) {
    const fanout = (i % 3) + 1
    for (let k = 0; k < fanout; k++) {
      const target = (i * 7 + k * 13) % i
      if (target === i) continue
      const type = relations[(i + k) % relations.length]
      allLinks.push({ source: allNodes[i].id, target: allNodes[target].id, type })
      deg[i] += 1
      deg[target] += 1
    }
  }
  allNodes.forEach((n, i) => (n.deg = deg[i]))

  return cropGraph(allNodes, allLinks, {
    mode: params.mode ?? 'full',
    maxNodes: params.maxNodes ?? (params.mode === 'summary' ? 50 : 300),
    minDeg: params.minDeg ?? 0,
  })
}

/** 按度数降序裁剪节点 + 过滤弱连接，模拟后端 /kb/graph 行为 */
function cropGraph(
  allNodes: KbGraphNode[],
  allLinks: KbGraph['links'],
  opts: { mode: 'full' | 'summary'; maxNodes: number; minDeg: number },
): KbGraph {
  let pool = allNodes.filter((n) => (n.deg ?? 0) >= opts.minDeg)
  pool = [...pool].sort((a, b) => (b.deg ?? 0) - (a.deg ?? 0)).slice(0, opts.maxNodes)
  const keep = new Set(pool.map((n) => n.id))
  const links = allLinks.filter((l) => keep.has(l.source) && keep.has(l.target))
  return {
    nodes: pool,
    links,
    meta: {
      totalNodes: allNodes.length,
      totalLinks: allLinks.length,
      returnedNodes: pool.length,
      returnedLinks: links.length,
      truncated: pool.length < allNodes.length,
      source: 'relation',
      mode: opts.mode,
    },
  }
}

/** 模拟 ego：返回中心节点 + 一跳邻居 */
function mockEgo(docId: number | string): KbGraph {
  const full = mockGraph({ mode: 'full', maxNodes: 2000 })
  const center = String(docId)
  const neighborIds = new Set<string>([center])
  full.links.forEach((l) => {
    if (l.source === center) neighborIds.add(l.target)
    if (l.target === center) neighborIds.add(l.source)
  })
  const nodes = full.nodes.filter((n) => neighborIds.has(n.id))
  const links = full.links.filter((l) => neighborIds.has(l.source) && neighborIds.has(l.target))
  return {
    nodes,
    links,
    meta: {
      totalNodes: full.nodes.length,
      totalLinks: full.links.length,
      returnedNodes: nodes.length,
      returnedLinks: links.length,
      truncated: false,
      source: 'relation',
      mode: 'ego',
    },
  }
}

function mockLint(): KbLintReport {
  return {
    broken: [{ page: '90001', title: '本地启动指南', target: '不存在的页' }],
    orphans: [{ slug: 'interview/spring-事务', title: 'Spring 事务（面试题系列）' }],
    noSummary: [],
    counts: { pages: MOCK_PAGES.length, broken: 1, orphans: 1, noSummary: 0 },
  }
}

// ---------------------------------------------------------------------------
// 1. 空间
// ---------------------------------------------------------------------------

/** 当前用户可读空间（含 canEdit/canAdmin） */
export async function getKbAccessibleSpacesApi() {
  if (USE_MOCK) {
    await delay(120)
    return ok<KbAccessibleSpace[]>([
      {
        id: '900000000000000001',
        spaceCode: 'enterprise-kb',
        spaceName: '企业知识库',
        description: '公司级知识沉淀',
        visibility: 2,
        canEdit: true,
        canAdmin: false,
      },
      {
        id: 900000000000000002,
        spaceCode: 'jp-fe-ap-exam',
        spaceName: '日本語試験（FE/AP）',
        description: '基本情報・応用情報备考',
        visibility: 0,
        canEdit: true,
        canAdmin: false,
      },
    ])
  }
  return request<KbAccessibleSpace[]>(`${KB_BASE}/space/mine`, { method: 'GET' })
}

/** 当前用户可管理空间（空间管理页；平台超管=全部） */
export async function getKbManageSpacesApi() {
  if (USE_MOCK) {
    return getKbAccessibleSpacesApi()
  }
  return request<KbAccessibleSpace[]>(`${KB_BASE}/space/manage`, { method: 'GET' })
}

export async function getKbSpaceApi(id: number | string) {
  if (USE_MOCK) {
    await delay(100)
    return ok<import('@/types/knowledge').KbSpace>({
      id,
      spaceCode: 'enterprise-kb',
      spaceName: '企业知识库',
      visibility: 2,
      status: 1,
    })
  }
  return request<import('@/types/knowledge').KbSpace>(`${KB_BASE}/space/${id}`, { method: 'GET' })
}

export async function createKbSpaceApi(data: import('@/types/knowledge').KbSpace) {
  if (USE_MOCK) {
    await delay(200)
    return ok<number | string>(Date.now())
  }
  return request<number | string>(`${KB_BASE}/space`, { method: 'POST', body: jsonEntityBody(data as Record<string, unknown>) })
}

export async function updateKbSpaceApi(data: import('@/types/knowledge').KbSpace) {
  if (USE_MOCK) {
    await delay(200)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/space`, { method: 'PUT', body: jsonEntityBody(data as Record<string, unknown>) })
}

export async function deleteKbSpaceApi(id: number | string) {
  if (USE_MOCK) {
    await delay(150)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/space/${id}`, { method: 'DELETE' })
}

export async function listKbSpaceMembersApi(spaceId: number | string) {
  if (USE_MOCK) {
    await delay(150)
    return ok<import('@/types/knowledge').KbSpaceMember[]>([
      { id: '1', spaceId, memberType: 0, memberId: '719712653013942272', role: 'admin' },
    ])
  }
  return request<import('@/types/knowledge').KbSpaceMember[]>(
    `${KB_BASE}/space/member/list${buildQuery({ spaceId })}`,
    { method: 'GET' },
  )
}

export async function addKbSpaceMemberApi(data: import('@/types/knowledge').KbSpaceMember) {
  if (USE_MOCK) {
    await delay(150)
    return ok<number | string>(Date.now())
  }
  return request<number | string>(`${KB_BASE}/space/member`, { method: 'POST', body: jsonEntityBody(data as Record<string, unknown>) })
}

export async function batchAddKbSpaceMembersApi(data: import('@/types/knowledge').KbSpaceMemberBatchAddRequest) {
  if (USE_MOCK) {
    await delay(180)
    return ok<import('@/types/knowledge').KbSpaceMemberBatchResult>({
      successCount: data.memberIds.length,
      skipCount: 0,
      failCount: 0,
      memberRowIds: data.memberIds.map((_, i) => String(Date.now() + i)),
    })
  }
  return request<import('@/types/knowledge').KbSpaceMemberBatchResult>(`${KB_BASE}/space/member/batch`, {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateKbSpaceMemberApi(data: import('@/types/knowledge').KbSpaceMember) {
  if (USE_MOCK) {
    await delay(150)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/space/member`, { method: 'PUT', body: jsonEntityBody(data as Record<string, unknown>) })
}

export async function removeKbSpaceMemberApi(id: number | string) {
  if (USE_MOCK) {
    await delay(120)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/space/member/${id}`, { method: 'DELETE' })
}

export async function batchRemoveKbSpaceMembersApi(data: import('@/types/knowledge').KbSpaceMemberBatchRemoveRequest) {
  if (USE_MOCK) {
    await delay(150)
    return ok<import('@/types/knowledge').KbSpaceMemberBatchResult>({
      successCount: data.ids.length,
      skipCount: 0,
      failCount: 0,
      memberRowIds: data.ids,
    })
  }
  return request<import('@/types/knowledge').KbSpaceMemberBatchResult>(`${KB_BASE}/space/member/batch/remove`, {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

// ---------------------------------------------------------------------------
// 2. 浏览
// ---------------------------------------------------------------------------

/** 目录 meta（按 groupBy=type|category 分组计数，不含 items） */
export async function getKbIndexApi(spaceId?: number | string, groupBy: 'type' | 'category' = 'type') {
  if (USE_MOCK) {
    await delay(220)
    return ok<KbIndex>(mockIndexMeta())
  }
  return request<KbIndex>(`${KB_BASE}/index${buildQuery({ spaceId, groupBy })}`, { method: 'GET' })
}

/** 目录分组条目分页（key 为 kb_type 或 categoryId/uncategorized） */
export async function getKbIndexItemsApi(
  key: string,
  spaceId?: number | string,
  pageNum = 1,
  pageSize = 50,
  groupBy: 'type' | 'category' = 'type',
) {
  if (USE_MOCK) {
    await delay(120)
    const group = MOCK_INDEX.groups.find((g) => g.type === key)
    const items = group?.items ?? []
    const start = (pageNum - 1) * pageSize
    return ok<import('@/types/knowledge').KbIndexItemsPage>({
      type: key,
      label: group?.label ?? key,
      total: items.length,
      pageNum,
      pageSize,
      items: items.slice(start, start + pageSize),
    })
  }
  return request<import('@/types/knowledge').KbIndexItemsPage>(
    `${KB_BASE}/index/items${buildQuery({ spaceId, groupBy, key, pageNum, pageSize })}`,
    { method: 'GET' },
  )
}

/** 目录搜索（服务端过滤） */
export async function searchKbIndexApi(q: string, spaceId?: number | string, limit = 200, groupBy: 'type' | 'category' = 'type') {
  if (USE_MOCK) {
    await delay(160)
    const kw = q.trim().toLowerCase()
    const groups = MOCK_INDEX.groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.title.toLowerCase().includes(kw)
            || it.slug.toLowerCase().includes(kw)
            || (it.summary?.toLowerCase().includes(kw) ?? false),
        ),
      }))
      .filter((g) => g.items.length)
    const total = groups.reduce((s, g) => s + g.items.length, 0)
    return ok<KbIndex>({ total, groups })
  }
  return request<KbIndex>(`${KB_BASE}/index/search${buildQuery({ spaceId, q, limit, groupBy })}`, { method: 'GET' })
}

/** 按 slug 定位目录分组 */
export async function locateKbIndexApi(slug: string, spaceId?: number | string, groupBy: 'type' | 'category' = 'type') {
  if (USE_MOCK) {
    await delay(80)
    for (const g of MOCK_INDEX.groups) {
      const item = g.items.find((it) => it.slug === slug)
      if (item) return ok<import('@/types/knowledge').KbIndexLocate>({ type: g.type, label: g.label, item })
    }
    return ok<import('@/types/knowledge').KbIndexLocate | undefined>(undefined)
  }
  return request<import('@/types/knowledge').KbIndexLocate>(
    `${KB_BASE}/index/locate${buildQuery({ spaceId, slug, groupBy })}`,
    { method: 'GET' },
  )
}

/** 移动文档到另一分类(=目录)：移 wiki 文件 + 改引用 + 触发 Sync */
export async function moveKbDocumentApi(id: number | string, toCategoryId: number | string) {
  return request<import('@/types/knowledge').KbDocumentMoveResult>(
    `${KB_BASE}/document/${toEntityId(id)}/move${buildQuery({ toCategoryId: toEntityId(toCategoryId) })}`,
    { method: 'PUT' },
  )
}

/** 单页详情（slug 含斜杠，走查询参数） */
export async function getKbPageApi(slug: string, spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(180)
    return ok<KbPage | undefined>(MOCK_PAGES.find((p) => p.slug === slug))
  }
  return request<KbPage>(`${KB_BASE}/page${buildQuery({ slug, spaceId })}`, { method: 'GET' })
}

// ---------------------------------------------------------------------------
// 3. Query 问答
// ---------------------------------------------------------------------------

export async function getKbLlmConfigApi() {
  if (USE_MOCK) {
    await delay(80)
    return ok<import('@/types/knowledge').KbLlmConfig>({
      available: false,
      configEnabled: false,
      apiKeyConfigured: false,
      provider: 'mock',
      model: 'mock',
    })
  }
  return request<import('@/types/knowledge').KbLlmConfig>(`${KB_BASE}/ask/llm-config`, { method: 'GET' })
}

export async function askKbApi(payload: KbAskRequest) {
  if (USE_MOCK) {
    await delay(600)
    const kw = payload.question.trim().toLowerCase()
    const hits = MOCK_PAGES.filter(
      (p) => p.title.toLowerCase().includes(kw) || p.summary?.toLowerCase().includes(kw),
    ).slice(0, payload.topK ?? 8)
    const list = hits.length ? hits : MOCK_PAGES.slice(0, 2)
    return ok<KbAskResponse>({
      answer: hits.length
        ? `根据「${hits[0].title}」：${hits[0].summary} [[${hits[0].slug}]]`
        : `未命中高相关内容，以下为可能相关的页面。`,
      mode: 'retrieval',
      scope: '[全库]',
      scopeReason: 'Mock 模式下不调用 LLM，降级为检索式',
      provider: 'mock',
      model: 'mock',
      citations: list.map((p) => ({
        docId: p.docId,
        spaceId: p.spaceId ?? '900000000000000001',
        slug: p.slug,
        title: p.title,
        kbType: p.kbType,
        snippet: p.summary,
      })),
      qaLogId: Date.now(),
    })
  }
  return request<KbAskResponse>(`${KB_BASE}/ask`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    /** 生成式问答会调 LLM，后端 timeout 90s；默认 8s 会误报超时 */
    timeoutMs: 120_000,
  })
}

// ---------------------------------------------------------------------------
// 4.1 关系图谱
// ---------------------------------------------------------------------------

export async function getKbGraphApi(params: KbGraphParams = {}) {
  if (USE_MOCK) {
    await delay(280)
    return ok<KbGraph>(mockGraph(params))
  }
  return request<KbGraph>(
    `${KB_BASE}/graph${buildQuery({
      spaceId: params.spaceId,
      mode: params.mode,
      maxNodes: params.maxNodes,
      minDeg: params.minDeg,
    })}`,
    { method: 'GET' },
  )
}

/** 4.1.1 邻域子图：以某文档为中心 BFS 拉取邻居，用于点击节点增量展开 */
export async function getKbGraphEgoApi(docId: number | string, params: KbGraphEgoParams = {}) {
  if (USE_MOCK) {
    await delay(200)
    return ok<KbGraph>(mockEgo(docId))
  }
  return request<KbGraph>(
    `${KB_BASE}/graph/ego${buildQuery({
      docId,
      spaceId: params.spaceId,
      depth: params.depth,
      maxNodes: params.maxNodes,
    })}`,
    { method: 'GET' },
  )
}

// ---------------------------------------------------------------------------
// 4.2-4.5 体检
// ---------------------------------------------------------------------------

/** 体检（只算不落库） */
export async function getKbLintApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(320)
    return ok<KbLintReport>(mockLint())
  }
  return request<KbLintReport>(`${KB_BASE}/lint${buildQuery({ spaceId })}`, { method: 'GET' })
}

/** 体检并落库（重建待处理问题） */
export async function scanKbLintApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(700)
    return ok<KbLintReport>(mockLint())
  }
  return request<KbLintReport>(`${KB_BASE}/lint/scan${buildQuery({ spaceId })}`, { method: 'POST' })
}

/** 体检问题列表 */
export async function getKbLintIssuesApi(params?: { spaceId?: number | string; status?: KbLintIssueStatus }) {
  if (USE_MOCK) {
    await delay(200)
    return ok<KbLintIssue[]>([
      {
        id: 1,
        documentId: 90001,
        issueType: 'broken_link',
        detail: '断链：指向「不存在的页」',
        status: 0,
        scanTime: '2026-06-22 14:00:00',
      },
      {
        id: 2,
        documentId: 90020,
        issueType: 'orphan',
        detail: '孤儿页：无任何出/入链',
        status: 0,
        scanTime: '2026-06-22 14:00:00',
      },
    ])
  }
  return request<KbLintIssue[]>(`${KB_BASE}/lint/issues${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

/** 更新体检问题状态：0 待处理 / 1 已忽略 / 2 已修复 */
export async function updateKbLintIssueApi(id: number | string, status: KbLintIssueStatus) {
  if (USE_MOCK) {
    await delay(150)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/lint/issue/${id}${buildQuery({ status })}`, { method: 'PUT' })
}

// ---------------------------------------------------------------------------
// 3.2 问答历史与反馈
// ---------------------------------------------------------------------------

export async function getKbAskHistoryApi(params?: {
  spaceId?: number | string
  pageNum?: number
  pageSize?: number
}) {
  if (USE_MOCK) {
    await delay(200)
    return ok<MoliPage<KbQaHistory>>({
      records: [],
      total: 0,
      size: params?.pageSize ?? 10,
      current: params?.pageNum ?? 1,
    })
  }
  return request<MoliPage<KbQaHistory>>(`${KB_BASE}/ask/history${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function feedbackKbAskApi(id: number | string, useful: 0 | 1) {
  if (USE_MOCK) {
    await delay(120)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/ask/feedback/${id}${buildQuery({ useful })}`, { method: 'PUT' })
}

// ---------------------------------------------------------------------------
// 5. 文档管理 / 详情 / 附件
// ---------------------------------------------------------------------------

export async function searchKbDocumentsApi(params: KbDocumentSearchParams) {
  if (USE_MOCK) {
    await delay(180)
    const kw = params.keyword?.trim().toLowerCase() ?? ''
    const status = params.status
    let items: KbDocumentListItem[] = MOCK_PAGES.map(mockPageToListItem)
    const sid = params.spaceId != null ? String(params.spaceId) : ''
    if (sid) items = items.filter((it) => String(it.spaceId ?? '') === sid)
    if (params.source === 'kb') items = items.filter((it) => it.source === 'kb')
    if (status !== undefined && status !== '') items = items.filter((it) => it.status === status)
    if (kw) {
      items = items.filter(
        (it) =>
          it.title.toLowerCase().includes(kw)
          || (it.summary?.toLowerCase().includes(kw) ?? false)
          || (it.slug?.toLowerCase().includes(kw) ?? false),
      )
    }
    const pageNum = params.pageNum ?? 1
    const pageSize = params.pageSize ?? 15
    const start = (pageNum - 1) * pageSize
    const slice = items.slice(start, start + pageSize)
    return ok<MoliPage<KbDocumentListItem>>({
      records: slice,
      total: items.length,
      size: pageSize,
      current: pageNum,
    })
  }
  return request<MoliPage<KbDocumentListItem>>(
    `${KB_BASE}/document/search${buildKbDocumentSearchQuery(params)}`,
    { method: 'GET' },
  )
}

export async function getKbDocumentApi(id: number | string) {
  if (USE_MOCK) {
    await delay(150)
    const p = MOCK_PAGES.find((x) => String(x.docId) === String(id))
    if (!p) return ok<KbDocumentDetail | undefined>(undefined)
    return ok<KbDocumentDetail>(mockPageToDetail(p))
  }
  return request<KbDocumentDetail>(`${KB_BASE}/document/${toEntityId(id)}`, { method: 'GET' })
}

// ---------------------------------------------------------------------------
// 5.2 分类 / 5.3 标签
// ---------------------------------------------------------------------------

export async function getKbCategoryTreeApi(spaceId: number | string, withCount = false) {
  if (USE_MOCK) {
    await delay(100)
    return ok<KbCategoryTree[]>(mockCategoryTreeState)
  }
  return request<KbCategoryTree[]>(`${KB_BASE}/category/tree${buildQuery({ spaceId, withCount: withCount ? 'true' : undefined })}`, { method: 'GET' })
}

export async function saveKbCategoryApi(data: KbCategorySaveRequest) {
  if (USE_MOCK) {
    await delay(120)
    const parentId = String(data.parentId ?? 0)
    if (data.id != null && data.id !== '') {
      walkCategoryTree(mockCategoryTreeState, (node) => {
        if (String(node.id) === String(data.id)) {
          node.categoryName = data.categoryName
          node.sort = data.sort ?? node.sort
          return true
        }
        return false
      })
      return ok<number | string | boolean>(String(data.id))
    }
    const id = String(++mockCategorySeq)
    appendMockCategory(parentId, {
      id,
      spaceId: data.spaceId,
      parentId: parentId === '0' ? 0 : data.parentId,
      categoryName: data.categoryName,
      sort: data.sort ?? 0,
      children: [],
    })
    return ok<number | string>(id)
  }
  if (data.id != null && data.id !== '') {
    return request<boolean>(`${KB_BASE}/category`, {
      method: 'PUT',
      body: jsonEntityBody(data as Record<string, unknown>),
    })
  }
  return request<number | string>(`${KB_BASE}/category`, {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function deleteKbCategoryApi(id: number | string) {
  if (USE_MOCK) {
    await delay(100)
    walkCategoryTree(mockCategoryTreeState, (node, parent, index) => {
      if (String(node.id) === String(id)) {
        if (node.children?.length) throw new Error('请先删除子分类')
        parent?.splice(index, 1)
        return true
      }
      return false
    })
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/category/${toEntityId(id)}`, { method: 'DELETE' })
}

export async function listKbTagsApi(spaceId: number | string) {
  if (USE_MOCK) {
    await delay(100)
    return ok<KbTag[]>(mockTagsState)
  }
  return request<KbTag[]>(`${KB_BASE}/tag/list${buildQuery({ spaceId })}`, { method: 'GET' })
}

export async function saveKbTagApi(data: KbTagSaveRequest) {
  if (USE_MOCK) {
    await delay(120)
    if (data.id != null && data.id !== '') {
      const idx = mockTagsState.findIndex((t) => String(t.id) === String(data.id))
      if (idx >= 0) {
        mockTagsState[idx] = { ...mockTagsState[idx], tagName: data.tagName, color: data.color }
      }
      return ok<number | string | boolean>(String(data.id))
    }
    const id = String(++mockTagSeq)
    mockTagsState.push({ id, spaceId: data.spaceId, tagName: data.tagName, color: data.color })
    return ok<number | string>(id)
  }
  if (data.id != null && data.id !== '') {
    return request<boolean>(`${KB_BASE}/tag`, {
      method: 'PUT',
      body: jsonEntityBody(data as Record<string, unknown>),
    })
  }
  return request<number | string>(`${KB_BASE}/tag`, {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function deleteKbTagApi(id: number | string) {
  if (USE_MOCK) {
    await delay(100)
    mockTagsState = mockTagsState.filter((t) => String(t.id) !== String(id))
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/tag/${toEntityId(id)}`, { method: 'DELETE' })
}

export async function listKbAttachmentsApi(documentId: number | string) {
  if (USE_MOCK) {
    await delay(100)
    return ok<KbAttachment[]>([])
  }
  return request<KbAttachment[]>(`${KB_BASE}/attachment/list${buildQuery({ documentId })}`, { method: 'GET' })
}

export async function uploadKbAttachmentApi(documentId: number | string, file: File) {
  if (USE_MOCK) {
    await delay(400)
    return ok<KbAttachment>({
      id: Date.now(),
      documentId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    })
  }
  const form = new FormData()
  form.append('documentId', String(documentId))
  form.append('file', file)
  return request<KbAttachment>(`${KB_BASE}/attachment/upload`, {
    method: 'POST',
    body: form,
    timeoutMs: kbAttachmentUploadTimeoutMs(file.size),
  })
}

export async function deleteKbAttachmentApi(id: number | string) {
  if (USE_MOCK) {
    await delay(120)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/attachment/${id}`, { method: 'DELETE' })
}

export async function downloadKbAttachmentApi(id: number | string, fileName?: string) {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const token = getToken()
  const res = await fetch(`${base}${KB_BASE}/attachment/${id}`, {
    headers: token ? { Authorization: token } : {},
  })
  if (!res.ok) throw new Error(`下载失败 (HTTP ${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'attachment'
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// 6. Wiki 同步管理
// ---------------------------------------------------------------------------

export async function getKbSyncStatusApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(150)
    return ok<KbSyncStatus>({ batchNo: 'mock', total: 0, failCount: 0, actionCounts: {} })
  }
  return request<KbSyncStatus>(`${KB_BASE}/sync/status${buildQuery({ spaceId })}`, { method: 'GET' })
}

export async function getKbSyncLogsApi(params?: {
  spaceId?: number | string
  batchNo?: string
  pageNum?: number
  pageSize?: number
}) {
  if (USE_MOCK) {
    await delay(180)
    return ok<MoliPage<KbSyncLog>>({ records: [], total: 0, size: 10, current: 1 })
  }
  return request<MoliPage<KbSyncLog>>(`${KB_BASE}/sync/logs${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function triggerKbSyncApi(params?: { spaceId?: number | string; spaceCode?: string }) {
  if (USE_MOCK) {
    await delay(800)
    return ok<KbSyncTrigger>({ success: true, exitCode: 0, spaceCode: 'enterprise-kb', outputTail: 'mock sync ok' })
  }
  return request<KbSyncTrigger>(`${KB_BASE}/sync/trigger${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'POST',
    timeoutMs: 320_000,
  })
}

// ---------------------------------------------------------------------------
// 8. Wiki 在线编辑 /kb/wiki/page（T14a）
// ---------------------------------------------------------------------------

/** Mock：以 slug 为键存草稿，离线演示读写闭环 */
const mockWikiFiles = new Map<string, string>()

function mockHash(text: string) {
  let h = 5381
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return `mock-${text.length}-${h.toString(16)}`
}

/** GET /kb/wiki/page —— 读 wiki 文件全文（需空间 editor） */
export async function getKbWikiPageApi(slug: string, spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(160)
    const stored = mockWikiFiles.get(slug)
    const fromPage = MOCK_PAGES.find((p) => p.slug === slug)
    const content = stored
      ?? (fromPage ? `---\ntitle: ${fromPage.title}\nslug: ${fromPage.slug}\n---\n\n${fromPage.content ?? ''}` : '')
    return ok<KbWikiPage>({
      slug,
      spaceId,
      spaceCode: 'enterprise-kb',
      relativePath: `wiki/${slug}.md`,
      content,
      contentHash: mockHash(content),
      exists: stored != null || fromPage != null,
    })
  }
  return request<KbWikiPage>(`${KB_BASE}/wiki/page${buildQuery({ slug, spaceId })}`, { method: 'GET' })
}

/** PUT /kb/wiki/page —— 写 wiki 文件（需空间 editor，保存后需 Sync 才进库） */
export async function saveKbWikiPageApi(payload: KbWikiSaveRequest) {
  if (USE_MOCK) {
    await delay(240)
    const existed = mockWikiFiles.has(payload.slug) || MOCK_PAGES.some((p) => p.slug === payload.slug)
    mockWikiFiles.set(payload.slug, payload.content)
    return ok<KbWikiSaveResult>({
      slug: payload.slug,
      spaceId: payload.spaceId,
      relativePath: `wiki/${payload.slug}.md`,
      created: !existed,
      contentHash: mockHash(payload.content),
      savedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
  }
  return request<KbWikiSaveResult>(`${KB_BASE}/wiki/page`, {
    method: 'PUT',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** POST /kb/wiki/ai-revise —— AI 改稿建议（不写盘） */
export async function aiReviseKbWikiApi(payload: KbWikiAiReviseRequest) {
  if (USE_MOCK) {
    await delay(900)
    const base = payload.baselineContent ?? mockWikiFiles.get(payload.slug)
      ?? MOCK_PAGES.find((p) => p.slug === payload.slug)?.content
      ?? ''
    const suggested = `${base}\n\n<!-- AI mock: ${payload.instruction} -->`
    return ok<KbWikiAiReviseResult>({
      suggestedContent: suggested.startsWith('---') ? suggested : `---\ntitle: mock\nslug: ${payload.slug}\n---\n\n${suggested}`,
      provider: 'mock',
      model: 'mock',
      notes: 'Mock 模式演示',
    })
  }
  return request<KbWikiAiReviseResult>(`${KB_BASE}/wiki/ai-revise`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 120_000,
  })
}

/** POST /kb/wiki/page/lint-preview —— 保存前 lint 预检 */
export async function previewKbWikiLintApi(payload: KbWikiLintPreviewRequest) {
  if (USE_MOCK) {
    await delay(120)
    const issues: KbWikiLintPreview['issues'] = []
    if (!payload.content.includes('[[')) {
      /* no wikilinks */
    } else if (payload.content.includes('[[不存在的页]]')) {
      issues.push({ type: 'broken_link', message: '断链：[[不存在的页]]' })
    }
    return ok<KbWikiLintPreview>({ issueCount: issues.length, issues })
  }
  return request<KbWikiLintPreview>(`${KB_BASE}/wiki/page/lint-preview`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** POST /kb/wiki/lint-space —— 空间级文件 Lint（文件真值，T16a） */
export async function lintWikiSpaceApi(payload: KbWikiSpaceLintRequest) {
  if (USE_MOCK) {
    await delay(600)
    return ok<KbWikiSpaceLintResult>({
      spaceCode: payload.spaceCode ?? 'enterprise-kb',
      wikiDir: 'wiki',
      stats: {
        pages: 42,
        issues: 5,
        errors: 2,
        warnings: 2,
        infos: 1,
        by_kind: {
          broken_link: 1,
          orphan: 1,
          missing_source: 2,
          missing_dates: 1,
        },
      },
      issues: [
        {
          level: 'error',
          kind: 'broken_link',
          page: 'guides/本地启动指南',
          detail: '→ [[不存在的页]]',
          suggest: '建该页或改链',
        },
        {
          level: 'error',
          kind: 'orphan',
          page: 'concepts/孤儿概念',
          detail: '无入链',
          suggest: '在相关页添加 [[concepts/孤儿概念]]',
        },
        {
          level: 'warn',
          kind: 'missing_source',
          page: 'guides/本地启动指南',
          detail: 'frontmatter 缺 sources',
          suggest: '补全 sources 数组',
        },
        {
          level: 'warn',
          kind: 'missing_source',
          page: 'services/用户中心',
          detail: 'sources 为空',
          suggest: '添加 raw/prd 引用',
        },
        {
          level: 'info',
          kind: 'missing_dates',
          page: 'guides/增量ingest指南',
          detail: '缺 updated 字段',
          suggest: '补 frontmatter updated',
        },
      ],
      exitCode: 1,
      outputTail: '[FAIL] 体检未通过（errors=2 warnings=2）',
    })
  }
  return request<KbWikiSpaceLintResult>(`${KB_BASE}/wiki/lint-space`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 130_000,
  })
}

/** GET /kb/wiki/govern/options —— Wiki 治理 kb.llm 模型列表 */
export async function getKbWikiGovernOptionsApi() {
  if (USE_MOCK) {
    await delay(80)
    return ok<KbWikiGovernOptions>({
      llmAvailable: true,
      provider: 'mock',
      defaultModel: 'glm-4-flash',
      models: [
        { id: 'glm-4-flash', displayName: 'glm-4-flash' },
        { id: 'deepseek-chat', displayName: 'deepseek-chat' },
      ],
    })
  }
  return request<KbWikiGovernOptions>(`${KB_BASE}/wiki/govern/options`)
}

/** POST /kb/wiki/enrich —— 已有页 enrich + 治理 log/index/edges */
export async function enrichKbWikiApi(payload: KbWikiEnrichRequest) {
  if (USE_MOCK) {
    await delay(400)
    const dryRun = payload.dryRun ?? false
    if (payload.items?.length) {
      return ok<KbWikiEnrichResult>({
        batchNo: payload.batchNo ?? 'mock',
        topic: payload.topic ?? 'enrich',
        dryRun,
        items: payload.items.map((item) => ({
          slug: item.slug,
          patch: item.patch ?? '## Mock enrich',
          applied: !dryRun,
        })),
        logAppended: !dryRun,
        indexUpdated: !dryRun,
        edgesAppended: payload.edges?.length ?? 0,
      })
    }
    const slug = payload.slug ?? 'guides/mock'
    return ok<KbWikiEnrichResult>({
      batchNo: payload.batchNo ?? 'mock',
      topic: payload.topic ?? 'enrich',
      dryRun,
      items: [{ slug, patch: payload.patch ?? '## Mock', applied: !dryRun }],
      logAppended: !dryRun,
      indexUpdated: !dryRun,
      edgesAppended: payload.edges?.length ?? 0,
    })
  }
  return request<KbWikiEnrichResult>(`${KB_BASE}/wiki/enrich`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: payload.rawPaths?.length || payload.items?.some((i) => i.rawPaths?.length) ? 180_000 : 60_000,
  })
}

/* ------------------------------------------------------------------ */
/* Ingest 工作台（T15a）                                               */
/* ------------------------------------------------------------------ */

/** GET /kb/ingest/raw-tree —— raw 只读目录树 */
export async function getKbIngestRawTreeApi(prefix?: string) {
  if (USE_MOCK) {
    await delay(160)
    return ok<KbRawTreeNode[]>([
      {
        name: 'design',
        path: 'design',
        type: 'dir',
        children: [
          { name: 'redis-sentinel.note.md', path: 'design/redis-sentinel.note.md', type: 'file', size: 2048 },
        ],
      },
    ])
  }
  return request<KbRawTreeNode[]>(`${KB_BASE}/ingest/raw-tree${buildQuery({ prefix })}`, { method: 'GET' })
}

/** GET /kb/ingest/raw-coverage —— wiki sources 反向索引（筛未 ingest raw） */
export async function getKbIngestRawCoverageApi(params?: {
  spaceId?: number | string
  prefix?: string
  filter?: KbRawCoverageFilter
  refresh?: boolean
}) {
  if (USE_MOCK) {
    await delay(120)
    return ok<KbRawCoverage>({
      spaceId: params?.spaceId ?? '900000000000000001',
      spaceCode: 'enterprise-kb',
      wikiDir: 'wiki',
      wikiPageCount: 12,
      filter: params?.filter ?? 'all',
      summary: { totalFiles: 2, covered: 1, cluster: 0, open: 1 },
      items: [
        {
          path: 'design/redis-sentinel.note.md',
          coverage: 'covered',
          matchKind: 'exact',
          wikiSlugs: ['concepts/redis-哨兵'],
          inFlightJobIds: [],
        },
        {
          path: 'design/new-topic.note.md',
          coverage: 'open',
          matchKind: 'none',
          wikiSlugs: [],
          inFlightJobIds: [],
        },
      ],
    })
  }
  return request<KbRawCoverage>(
    `${KB_BASE}/ingest/raw-coverage${buildQuery({
      spaceId: params?.spaceId,
      prefix: params?.prefix,
      filter: params?.filter,
      refresh: params?.refresh ? 'true' : undefined,
    })}`,
    { method: 'GET' },
  )
}

/** POST /kb/ingest/jobs —— 创建批次（需空间 editor） */
export async function createKbIngestJobApi(payload: KbIngestJobCreateRequest) {
  if (USE_MOCK) {
    await delay(200)
    return ok<KbIngestJob>({
      id: Date.now(),
      spaceId: payload.spaceId,
      spaceCode: 'enterprise-kb',
      batchNo: payload.batchNo ?? `WB-${Date.now()}`,
      topic: payload.topic,
      expectTypes: payload.expectTypes,
      rawPaths: payload.rawPaths,
      status: 'created',
      planVersion: 0,
      canEdit: true,
    })
  }
  return request<KbIngestJob>(`${KB_BASE}/ingest/jobs`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** GET /kb/ingest/jobs —— 批次分页 */
export async function getKbIngestJobsApi(params?: {
  spaceId?: number | string
  status?: string
  pageNum?: number
  pageSize?: number
}) {
  if (USE_MOCK) {
    await delay(160)
    return ok<MoliPage<KbIngestJob>>({
      records: [],
      total: 0,
      size: params?.pageSize ?? 10,
      current: params?.pageNum ?? 1,
    })
  }
  return request<MoliPage<KbIngestJob>>(
    `${KB_BASE}/ingest/jobs${buildQuery(params as Record<string, string | number | undefined>)}`,
    { method: 'GET' },
  )
}

/** GET /kb/ingest/jobs/{id} —— 批次详情（含最新 plan） */
export async function getKbIngestJobApi(id: number | string) {
  return request<KbIngestJob>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}`, { method: 'GET' })
}

/** DELETE /kb/ingest/jobs/{id} —— 删除历史批次（软删，不回滚已 commit 的 wiki） */
export async function deleteKbIngestJobApi(id: number | string) {
  if (USE_MOCK) {
    await delay(120)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}`, { method: 'DELETE' })
}

/** POST /kb/ingest/jobs/{id}/plan —— 生成/刷新 Plan（LLM 或骨架） */
export async function generateKbIngestPlanApi(id: number | string) {
  return request<KbIngestJob>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/plan`, {
    method: 'POST',
    timeoutMs: 120_000,
  })
}

/** PUT /kb/ingest/jobs/{id}/plan —— 人工编辑 Plan */
export async function updateKbIngestPlanApi(id: number | string, payload: KbIngestPlanUpdateRequest) {
  return request<KbIngestJob>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/plan`, {
    method: 'PUT',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** GET /kb/ingest/jobs/{id}/export-agent-prompt —— 导出 Cursor 提示词 */
export async function exportKbIngestAgentPromptApi(id: number | string) {
  return request<string>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/export-agent-prompt`, { method: 'GET' })
}

/* ---- T15b 生成 / 审阅 ---- */

/** POST /kb/ingest/jobs/{id}/generate —— 按 plan 生成多页草稿；resume 断点续跑 */
export async function generateKbIngestDraftsApi(id: number | string, resume = false) {
  return request<KbIngestGenerateResult>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/generate${buildQuery({ resume: String(resume) })}`,
    { method: 'POST', timeoutMs: 300_000 },
  )
}

/** GET /kb/ingest/jobs/{id}/drafts —— 草稿列表 */
export async function getKbIngestDraftsApi(id: number | string) {
  return request<KbIngestDraft[]>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/drafts`, { method: 'GET' })
}

/** GET /kb/ingest/jobs/{id}/draft?slug= —— 单页草稿 */
export async function getKbIngestDraftApi(id: number | string, slug: string) {
  return request<KbIngestDraft>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/draft${buildQuery({ slug })}`, { method: 'GET' })
}

/** PUT /kb/ingest/jobs/{id}/draft?slug= —— 人工改草稿（enrich 可传 patch） */
export async function updateKbIngestDraftApi(
  id: number | string,
  slug: string,
  payload: { content?: string; patch?: string },
) {
  return request<KbIngestDraft>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/draft${buildQuery({ slug })}`, {
    method: 'PUT',
    body: jsonEntityBody(payload),
  })
}

/** POST /kb/ingest/jobs/{id}/draft/regenerate?slug= —— 单页重生成 */
export async function regenerateKbIngestDraftApi(id: number | string, slug: string) {
  return request<KbIngestDraft>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/draft/regenerate${buildQuery({ slug })}`, {
    method: 'POST',
    timeoutMs: 120_000,
  })
}

/** PUT /kb/ingest/jobs/{id}/draft/approval?slug=&approval= —— 设置审批 */
export async function setKbIngestDraftApprovalApi(
  id: number | string,
  slug: string,
  approval: 'approved' | 'rejected' | 'draft',
) {
  return request<KbIngestDraft>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/draft/approval${buildQuery({ slug, approval })}`,
    { method: 'PUT' },
  )
}

/* ---- T15c/d lint + commit + sync ---- */

/** POST /kb/ingest/jobs/{id}/lint —— commit 前 lint 预检 */
export async function lintKbIngestApi(id: number | string) {
  return request<KbIngestLint>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/lint`, { method: 'POST' })
}

/** POST /kb/ingest/jobs/{id}/commit?sync= —— 原子落盘（可选 Sync） */
export async function commitKbIngestApi(id: number | string, sync = false) {
  return request<KbIngestCommitResult>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/commit${buildQuery({ sync: String(sync) })}`,
    { method: 'POST', timeoutMs: 180_000 },
  )
}

/** T18 · POST /kb/ingest/jobs/express —— 创建批次 + Express Plan + 生成草稿 */
export async function expressStartKbIngestApi(payload: KbIngestJobCreateRequest, useLlmPlan = false) {
  return request<KbIngestExpressStartResult>(
    `${KB_BASE}/ingest/jobs/express${buildQuery({ useLlmPlan: String(useLlmPlan) })}`,
    {
      method: 'POST',
      body: jsonEntityBody(payload as Record<string, unknown>),
      timeoutMs: 300_000,
    },
  )
}

/** T18 · POST /kb/ingest/jobs/{id}/prepare */
export async function prepareKbIngestApi(id: number | string, useLlmPlan = false) {
  return request<KbIngestPrepareResult>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/prepare${buildQuery({ useLlmPlan: String(useLlmPlan) })}`,
    { method: 'POST', timeoutMs: 300_000 },
  )
}

/** T18 · POST /kb/ingest/jobs/{id}/publish */
export async function publishKbIngestApi(id: number | string, sync = true, approveAll = true) {
  return request<KbIngestPublishResult>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/publish${buildQuery({ sync: String(sync), approveAll: String(approveAll) })}`,
    { method: 'POST', timeoutMs: 300_000 },
  )
}

/* ---- T15e 模板 ---- */

export async function getKbIngestTemplatesApi(spaceId?: number | string) {
  return request<KbIngestTemplate[]>(`${KB_BASE}/ingest/templates${buildQuery({ spaceId })}`, { method: 'GET' })
}

export async function createKbIngestTemplateApi(payload: KbIngestTemplateCreateRequest) {
  return request<KbIngestTemplate>(`${KB_BASE}/ingest/templates`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

export async function deleteKbIngestTemplateApi(id: number | string) {
  if (USE_MOCK) {
    await delay(120)
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/ingest/templates/${toEntityId(id)}`, { method: 'DELETE' })
}

export async function createKbIngestJobFromTemplateApi(
  templateId: number | string,
  payload?: KbIngestJobFromTemplateRequest,
) {
  return request<KbIngestJob>(`${KB_BASE}/ingest/jobs/from-template/${toEntityId(templateId)}`, {
    method: 'POST',
    body: jsonEntityBody((payload ?? {}) as Record<string, unknown>),
  })
}

export async function saveKbIngestJobAsTemplateApi(id: number | string, payload: KbIngestSaveAsTemplateRequest) {
  return request<KbIngestTemplate>(`${KB_BASE}/ingest/jobs/${toEntityId(id)}/save-as-template`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}
