import { request } from '@/api/http'
import { kbAttachmentUploadTimeoutMs, kbWikiAssetUploadTimeoutMs } from '@/constants/knowledge'
import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type {
  KbAccessibleSpace,
  KbAskRequest,
  KbAskResponse,
  KbAttachment,
  KbWikiAssetUpload,
  KbBrowseScopeParams,
  KbCategoryTree,
  KbCategorySaveRequest,
  KbDocumentDetail,
  KbDocumentListItem,
  KbDocumentSearchParams,
  KbGraph,
  KbGraphEgoParams,
  KbGraphNode,
  KbGraphParams,
  KbWikiGraphParams,
  KbIndex,
  KbPage,
  KbQaHistory,
  KbSyncLog,
  KbSyncStatus,
  KbSyncTrigger,
  KbTag,
  KbTagSaveRequest,
  KbIndexTypesResult,
  KbMetaKbTypeOption,
  KbPlatformLlmConfig,
  KbPlatformLlmConfigSaveRequest,
  KbPlatformLlmConfigTestRequest,
  KbPlatformLlmConfigTestResult,
  MoliPage,
} from '@/types/knowledge'
import { registerKnowledgeMockPages } from '@/api/knowledge/mockRegistry'
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

/** 兼容 MyBatis Page 的 records / 部分网关的 list 字段 */
export function normalizeKbPageRecords<T>(data?: MoliPage<T> | Record<string, unknown> | null) {
  if (!data || typeof data !== 'object') return { records: [] as T[], total: 0 }
  const raw = data as Record<string, unknown>
  const records = (
    Array.isArray(raw.records) ? raw.records
      : Array.isArray(raw.list) ? raw.list
        : []
  ) as T[]
  const total = Number(raw.total ?? records.length) || 0
  return { records, total }
}

function buildKbBrowseScopeQuery(
  params?: KbBrowseScopeParams & {
    categoryId?: number | string
    uncategorizedOnly?: boolean
    groupBy?: string
    key?: string
    slug?: string
    q?: string
    limit?: number
    pageNum?: number
    pageSize?: number
  },
) {
  const qs = new URLSearchParams()
  if (params?.spaceId != null && params.spaceId !== '') qs.set('spaceId', String(params.spaceId))
  for (const sid of params?.spaceIds ?? []) {
    if (sid != null && sid !== '') qs.append('spaceIds', String(sid))
  }
  if (params?.categoryId != null) qs.set('categoryId', String(params.categoryId))
  for (const cid of params?.categoryIds ?? []) {
    if (cid != null && cid !== '') qs.append('categoryIds', String(cid))
  }
  if (params?.uncategorizedOnly === true) qs.set('uncategorizedOnly', 'true')
  if (params?.kbType?.trim()) qs.set('kbType', params.kbType.trim())
  for (const kt of params?.kbTypes ?? []) {
    if (kt?.trim()) qs.append('kbTypes', kt.trim())
  }
  if (params?.groupBy) qs.set('groupBy', String(params.groupBy))
  if (params?.key) qs.set('key', String(params.key))
  if (params?.slug) qs.set('slug', String(params.slug))
  if (params?.q) qs.set('q', String(params.q))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.pageNum != null) qs.set('pageNum', String(params.pageNum))
  if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize))
  const query = qs.toString()
  return query ? `?${query}` : ''
}

function buildKbDocumentSearchQuery(params: KbDocumentSearchParams) {
  const qs = new URLSearchParams()
  if (params.spaceId != null && params.spaceId !== '') qs.set('spaceId', String(params.spaceId))
  for (const sid of params.spaceIds ?? []) {
    if (sid != null && sid !== '') qs.append('spaceIds', String(sid))
  }
  if (params.categoryId != null) qs.set('categoryId', String(params.categoryId))
  for (const cid of params.categoryIds ?? []) {
    if (cid != null && cid !== '') qs.append('categoryIds', String(cid))
  }
  if (params.uncategorizedOnly === true) qs.set('uncategorizedOnly', 'true')
  if (params.keyword?.trim()) qs.set('keyword', params.keyword.trim())
  if (params.status !== undefined && params.status !== '') qs.set('status', String(params.status))
  if (params.tagId != null) qs.set('tagId', String(params.tagId))
  if (params.source?.trim()) qs.set('source', params.source.trim())
  if (params.kbType?.trim()) qs.set('kbType', params.kbType.trim())
  for (const kt of params.kbTypes ?? []) {
    if (kt?.trim()) qs.append('kbTypes', kt.trim())
  }
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
      '# 本地启动指南\n\n## 前置\n- JDK 17、MySQL 8、Node 18\n\n## 步骤\n1. 启动网关（28100）\n2. 启动用户中心（28101）\n3. 启动知识库服务（28104）\n\n相关：[[services/用户中心]]',
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

registerKnowledgeMockPages(MOCK_PAGES)

const MOCK_INDEX: KbIndex = {
  total: MOCK_PAGES.length,
  groups: [
    {
      type: '900000000000000101',
      label: '指南',
      count: MOCK_PAGES.filter((p) => p.kbType === 'guide').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'guide').map(toIndexItem),
    },
    {
      type: '900000000000000102',
      label: '微服务',
      count: MOCK_PAGES.filter((p) => p.kbType === 'service').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'service').map(toIndexItem),
    },
    {
      type: '900000000000000103',
      label: '概念',
      count: MOCK_PAGES.filter((p) => p.kbType === 'concept').length,
      items: MOCK_PAGES.filter((p) => p.kbType === 'concept').map(toIndexItem),
    },
    {
      type: '900000000000000104',
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

/** 目录 meta（默认按分类分组，不含 items） */
export async function getKbIndexApi(params?: KbBrowseScopeParams) {
  if (USE_MOCK) {
    await delay(220)
    return ok<KbIndex>(mockIndexMeta())
  }
  return request<KbIndex>(`${KB_BASE}/index${buildKbBrowseScopeQuery({ ...params, groupBy: 'category' })}`, { method: 'GET' })
}

/** 分类下体裁 facet（chip + 计数，仅 count>0） */
export async function getKbIndexTypesApi(params: KbBrowseScopeParams & {
  categoryId?: number | string
  uncategorizedOnly?: boolean
}) {
  if (USE_MOCK) {
    await delay(100)
    const labels: Record<string, string> = {
      guide: '操作指南',
      service: '服务实体',
      concept: '概念',
      article: '文章',
      interview: '面试题',
      output: '汇总',
    }
    const counts = new Map<string, number>()
    if (params.categoryId || params.uncategorizedOnly) {
      const groupKey = params.uncategorizedOnly ? 'uncategorized' : String(params.categoryId ?? '')
      const group = MOCK_INDEX.groups.find((g) => g.type === groupKey)
      const slugs = new Set((group?.items ?? []).map((it) => it.slug))
      for (const p of MOCK_PAGES) {
        if (slugs.size && !slugs.has(p.slug)) continue
        const kt = p.kbType ?? 'article'
        counts.set(kt, (counts.get(kt) ?? 0) + 1)
      }
    } else {
      for (const p of MOCK_PAGES) {
        const kt = p.kbType ?? 'article'
        counts.set(kt, (counts.get(kt) ?? 0) + 1)
      }
    }
    const items = [...counts.entries()]
      .filter(([, c]) => c > 0)
      .map(([kbType, count]) => ({ kbType, label: labels[kbType] ?? kbType, count }))
    const total = items.reduce((s, it) => s + it.count, 0)
    return ok<KbIndexTypesResult>({ items, total })
  }
  return request<KbIndexTypesResult>(
    `${KB_BASE}/index/types${buildKbBrowseScopeQuery({
      ...params,
      categoryId: params.uncategorizedOnly ? undefined : params.categoryId,
      uncategorizedOnly: params.uncategorizedOnly,
    })}`,
    { method: 'GET' },
  )
}

/** 体裁白名单（编辑/新建下拉单一数据源） */
export async function getKbMetaKbTypesApi() {
  if (USE_MOCK) {
    await delay(60)
    return ok<KbMetaKbTypeOption[]>([
      { value: 'guide', label: '操作指南' },
      { value: 'service', label: '服务实体' },
      { value: 'concept', label: '概念' },
      { value: 'article', label: '文章' },
      { value: 'interview', label: '面试题' },
      { value: 'output', label: '汇总' },
    ])
  }
  return request<KbMetaKbTypeOption[]>(`${KB_BASE}/meta/kb-types`, { method: 'GET' })
}

/** 目录分组条目分页（key 为 categoryId / uncategorized） */
export async function getKbIndexItemsApi(
  key: string,
  scope?: KbBrowseScopeParams,
  pageNum = 1,
  pageSize = 50,
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
    `${KB_BASE}/index/items${buildKbBrowseScopeQuery({ ...scope, key, pageNum, pageSize })}`,
    { method: 'GET' },
  )
}

/** 目录搜索（服务端过滤，结果按分类分组） */
export async function searchKbIndexApi(q: string, scope?: KbBrowseScopeParams, limit = 200) {
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
  return request<KbIndex>(`${KB_BASE}/index/search${buildKbBrowseScopeQuery({ ...scope, q, limit })}`, { method: 'GET' })
}

/** 按 slug 定位目录分组（type 字段为 categoryId 或 uncategorized） */
export async function locateKbIndexApi(slug: string, scope?: KbBrowseScopeParams) {
  if (USE_MOCK) {
    await delay(80)
    for (const g of MOCK_INDEX.groups) {
      const item = g.items.find((it) => it.slug === slug)
      if (item) return ok<import('@/types/knowledge').KbIndexLocate>({ type: g.type, label: g.label, item })
    }
    return ok<import('@/types/knowledge').KbIndexLocate | undefined>(undefined)
  }
  return request<import('@/types/knowledge').KbIndexLocate>(
    `${KB_BASE}/index/locate${buildKbBrowseScopeQuery({ ...scope, slug })}`,
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

/** Wiki 文件直读图谱：wikilink + related + graph/edges.jsonl（对齐 serve.py /api/graph） */
function mockWikiGraph(params: KbWikiGraphParams): KbGraph {
  const slugs = [
    'guides/本地启动指南',
    'guides/登录与鉴权指南',
    'develop/用户中心',
    'develop/网关',
    'concepts/分布式锁',
    'articles/redis分布式锁实现',
  ]
  const allNodes: KbGraphNode[] = slugs.map((slug) => ({
    id: slug,
    title: slug.split('/').pop() ?? slug,
    type: slug.split('/')[0],
    deg: 0,
  }))
  const allLinks: KbGraph['links'] = [
    { source: slugs[0], target: slugs[2], type: 'relates_to' },
    { source: slugs[0], target: slugs[1], type: 'depends_on' },
    { source: slugs[1], target: slugs[2], type: 'relates_to' },
    { source: slugs[2], target: slugs[3], type: 'relates_to' },
    { source: slugs[4], target: slugs[5], type: 'part_of' },
    { source: slugs[5], target: slugs[4], type: 'derived_from' },
  ]
  const deg = new Array(allNodes.length).fill(0)
  allLinks.forEach((l) => {
    const si = slugs.indexOf(l.source)
    const ti = slugs.indexOf(l.target)
    if (si >= 0) deg[si] += 1
    if (ti >= 0) deg[ti] += 1
  })
  allNodes.forEach((n, i) => (n.deg = deg[i]))
  const cropped = cropGraph(allNodes, allLinks, {
    mode: params.mode ?? 'summary',
    maxNodes: params.maxNodes ?? (params.mode === 'summary' ? 50 : 300),
    minDeg: params.minDeg ?? 0,
  })
  return { ...cropped, meta: { ...cropped.meta!, source: 'wiki_file' } }
}

export async function getKbWikiGraphApi(params: KbWikiGraphParams) {
  if (USE_MOCK) {
    await delay(280)
    return ok<KbGraph>(mockWikiGraph(params))
  }
  return request<KbGraph>(
    `${KB_BASE}/wiki/graph${buildQuery({
      spaceId: params.spaceId,
      mode: params.mode,
      maxNodes: params.maxNodes,
      minDeg: params.minDeg,
    })}`,
    { method: 'GET' },
  )
}

// ---------------------------------------------------------------------------
// 4.2-4.5 体检（O5–O8 见 kbLint.ts）
// ---------------------------------------------------------------------------

export {
  batchUpdateKbLintIssuesApi,
  getKbLintApi,
  getKbLintIssuesApi,
  getKbLintScanStatusApi,
  scanKbLintApi,
  updateKbLintIssueApi,
} from './knowledge/kbLint'

export { getKbOpsDashboardApi } from './knowledge/kbOps'

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
    const kbTypeSet = new Set(
      [...(params.kbTypes ?? []), params.kbType]
        .map((t) => String(t ?? '').trim())
        .filter(Boolean),
    )
    if (kbTypeSet.size) items = items.filter((it) => kbTypeSet.has(String(it.kbType ?? '')))
    const categoryIdSet = new Set(
      [...(params.categoryIds ?? []), params.categoryId]
        .map((c) => (c == null ? '' : String(c)))
        .filter((c) => c !== ''),
    )
    if (categoryIdSet.size || params.uncategorizedOnly) {
      items = items.filter((it) => {
        const cid = String(it.categoryId ?? '')
        if (categoryIdSet.has(cid)) return true
        if (params.uncategorizedOnly && !it.categoryId) return true
        return false
      })
    }
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

/** T22 F2：上传 wiki inline 插图至 {slug}.assets/ */
export async function uploadKbWikiAssetApi(spaceId: number | string, slug: string, file: File) {
  if (USE_MOCK) {
    await delay(300)
    const rel = `assets/${file.name.replace(/\s+/g, '-')}`
    return ok<KbWikiAssetUpload>({
      rel,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'image/png',
      markdown: `![${file.name.replace(/\.[^.]+$/, '')}](${rel})`,
    })
  }
  const form = new FormData()
  form.append('spaceId', String(spaceId))
  form.append('slug', slug)
  form.append('file', file)
  return request<KbWikiAssetUpload>(`${KB_BASE}/wiki/asset`, {
    method: 'POST',
    body: form,
    timeoutMs: kbWikiAssetUploadTimeoutMs(file.size),
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
    const mockLogs: KbSyncLog[] = [
      {
        id: 'mock-sync-ok',
        batchNo: 'mock-batch-1',
        action: 'upsert',
        sourcePath: 'guides/getting-started.md',
        status: 'success',
        message: '',
        createTime: '2026-07-12 10:00:00',
      },
      {
        id: 'mock-sync-fail',
        batchNo: 'mock-batch-1',
        action: 'upsert',
        sourcePath: 'missing/broken-page.md',
        status: 'fail',
        message: 'ENOENT: no such file or directory',
        createTime: '2026-07-12 10:00:01',
      },
    ]
    const pageNum = params?.pageNum ?? 1
    const pageSize = params?.pageSize ?? 10
    const start = (pageNum - 1) * pageSize
    const slice = mockLogs.slice(start, start + pageSize)
    return ok<MoliPage<KbSyncLog>>({
      records: slice,
      total: mockLogs.length,
      size: pageSize,
      current: pageNum,
    })
  }
  return request<MoliPage<KbSyncLog>>(`${KB_BASE}/sync/logs${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function triggerKbSyncApi(params?: {
  spaceId?: number | string
  spaceCode?: string
  /** 异步触发：立即返回，靠 status 轮询跟踪进度（KBOPS-2） */
  async?: boolean
}) {
  if (USE_MOCK) {
    await delay(800)
    return ok<KbSyncTrigger>({ success: true, exitCode: 0, spaceCode: 'enterprise-kb', outputTail: 'mock sync ok' })
  }
  const query: Record<string, string | number | undefined> = {
    spaceId: params?.spaceId,
    spaceCode: params?.spaceCode,
  }
  if (params?.async) query.async = 'true'
  return request<KbSyncTrigger>(`${KB_BASE}/sync/trigger${buildQuery(query)}`, {
    method: 'POST',
    timeoutMs: params?.async ? 30_000 : 320_000,
  })
}

// ---------------------------------------------------------------------------

export * from './knowledge/kbWiki'
export * from './knowledge/kbIngest'
export * from './knowledge/kbResearch'

// 平台 LLM 配置（系统管理 → 知识库 LLM）
// ---------------------------------------------------------------------------

let mockPlatformLlmConfig: KbPlatformLlmConfig = {
  enabled: false,
  provider: 'glm',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKeyConfigured: false,
  model: 'glm-4-flash',
  temperature: 0.3,
  timeoutSeconds: 90,
  extraModels: ['glm-4-flash', 'glm-4-air'],
  available: false,
  source: 'yaml_fallback',
  persistedInDatabase: false,
}

export async function getKbPlatformLlmConfigApi() {
  if (USE_MOCK) {
    await delay(120)
    return ok({ ...mockPlatformLlmConfig })
  }
  return request<KbPlatformLlmConfig>(`${KB_BASE}/platform/llm-config`, { method: 'GET' })
}

export async function saveKbPlatformLlmConfigApi(body: KbPlatformLlmConfigSaveRequest) {
  if (USE_MOCK) {
    await delay(200)
    const mask = body.apiKey?.trim()
      ? `****${body.apiKey.trim().slice(-4)}`
      : body.clearApiKey
        ? undefined
        : mockPlatformLlmConfig.apiKeyMask
    mockPlatformLlmConfig = {
      ...mockPlatformLlmConfig,
      enabled: body.enabled,
      provider: body.provider,
      baseUrl: body.baseUrl,
      model: body.model,
      temperature: body.temperature ?? mockPlatformLlmConfig.temperature,
      timeoutSeconds: body.timeoutSeconds ?? mockPlatformLlmConfig.timeoutSeconds,
      extraModels: body.extraModels ?? mockPlatformLlmConfig.extraModels,
      apiKeyConfigured: body.clearApiKey ? false : Boolean(mask || mockPlatformLlmConfig.apiKeyConfigured),
      apiKeyMask: mask,
      available: body.enabled && (body.clearApiKey ? false : Boolean(mask || mockPlatformLlmConfig.apiKeyConfigured)),
      source: body.clearApiKey ? 'yaml_fallback' : 'database',
      persistedInDatabase: body.clearApiKey ? false : Boolean(mask || mockPlatformLlmConfig.persistedInDatabase),
      updateTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
    return ok({ ...mockPlatformLlmConfig })
  }
  return request<KbPlatformLlmConfig>(`${KB_BASE}/platform/llm-config`, {
    method: 'PUT',
    body: jsonEntityBody(body as Record<string, unknown>),
  })
}

export async function testKbPlatformLlmConfigApi(body?: KbPlatformLlmConfigTestRequest) {
  if (USE_MOCK) {
    await delay(400)
    const enabled = body?.enabled ?? mockPlatformLlmConfig.enabled
    const hasKey = Boolean(body?.apiKey?.trim()) || mockPlatformLlmConfig.apiKeyConfigured
    if (!enabled || !hasKey) {
      return ok<KbPlatformLlmConfigTestResult>({
        success: false,
        latencyMs: 120,
        model: body?.model ?? mockPlatformLlmConfig.model,
        error: 'LLM 未启用或未配置 api-key',
      })
    }
    return ok<KbPlatformLlmConfigTestResult>({
      success: true,
      latencyMs: 842,
      model: body?.model ?? mockPlatformLlmConfig.model,
      replyPreview: 'pong',
    })
  }
  return request<KbPlatformLlmConfigTestResult>(`${KB_BASE}/platform/llm-config/test`, {
    method: 'POST',
    body: jsonEntityBody((body ?? {}) as Record<string, unknown>),
  })
}
