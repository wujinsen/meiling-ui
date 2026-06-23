import { request } from '@/api/http'
import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type {
  KbAccessibleSpace,
  KbAskRequest,
  KbAskResponse,
  KbAttachment,
  KbDocumentDetail,
  KbGraph,
  KbIndex,
  KbLintIssue,
  KbLintIssueStatus,
  KbLintReport,
  KbPage,
  KbQaHistory,
  KbSyncLog,
  KbSyncStatus,
  KbSyncTrigger,
  MoliPage,
} from '@/types/knowledge'
import { getToken } from '@/utils/authSession'
import { buildEntityQuery, jsonEntityBody } from '@/utils/id'

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

function buildQuery(params?: Record<string, string | number | undefined>) {
  return buildEntityQuery(params)
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
      items: MOCK_PAGES.filter((p) => p.kbType === 'guide').map(toIndexItem),
    },
    {
      type: 'service',
      label: '微服务',
      items: MOCK_PAGES.filter((p) => p.kbType === 'service').map(toIndexItem),
    },
    {
      type: 'concept',
      label: '概念',
      items: MOCK_PAGES.filter((p) => p.kbType === 'concept').map(toIndexItem),
    },
    {
      type: 'interview',
      label: '面试题',
      items: MOCK_PAGES.filter((p) => p.kbType === 'interview').map(toIndexItem),
    },
  ],
}

function toIndexItem(p: KbPage) {
  return { id: p.docId, slug: p.slug, title: p.title, summary: p.summary }
}

function mockGraph(): KbGraph {
  const types = ['service', 'concept', 'guide', 'interview', 'api', 'config']
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
  const nodes: KbGraph['nodes'] = titles.map((title, i) => ({
    id: String(90000 + i),
    title,
    type: types[i % types.length],
    deg: 0,
  }))

  const links: KbGraph['links'] = []
  const deg = new Array(nodes.length).fill(0)
  // 每个节点向前若干个节点连边，构造一张中等密度的图
  for (let i = 1; i < nodes.length; i++) {
    const fanout = (i % 3) + 1
    for (let k = 0; k < fanout; k++) {
      const target = (i * 7 + k * 13) % i
      if (target === i) continue
      const type = relations[(i + k) % relations.length]
      links.push({ source: nodes[i].id, target: nodes[target].id, type })
      deg[i] += 1
      deg[target] += 1
    }
  }
  nodes.forEach((n, i) => (n.deg = deg[i]))
  return { nodes, links }
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
        canEdit: false,
        canAdmin: false,
      },
      {
        id: 900000000000000002,
        spaceCode: 'jp-fe-ap-exam',
        spaceName: '日本語試験（FE/AP）',
        description: '基本情報・応用情報备考',
        visibility: 0,
        canEdit: false,
        canAdmin: false,
      },
    ])
  }
  return request<KbAccessibleSpace[]>(`${KB_BASE}/space/mine`, { method: 'GET' })
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

// ---------------------------------------------------------------------------
// 2. 浏览
// ---------------------------------------------------------------------------

/** 目录树（按知识类型分组的已发布文档） */
export async function getKbIndexApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(220)
    return ok<KbIndex>(MOCK_INDEX)
  }
  return request<KbIndex>(`${KB_BASE}/index${buildQuery({ spaceId })}`, { method: 'GET' })
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

export async function getKbGraphApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(280)
    return ok<KbGraph>(mockGraph())
  }
  return request<KbGraph>(`${KB_BASE}/graph${buildQuery({ spaceId })}`, { method: 'GET' })
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
// 5. 文档详情 / 附件
// ---------------------------------------------------------------------------

export async function getKbDocumentApi(id: number | string) {
  if (USE_MOCK) {
    await delay(150)
    const p = MOCK_PAGES.find((x) => String(x.docId) === String(id))
    if (!p) return ok<KbDocumentDetail | undefined>(undefined)
    return ok<KbDocumentDetail>({
      id: p.docId,
      spaceId: p.spaceId,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      content: p.content,
      kbType: p.kbType,
      domain: p.domain,
      status: p.status,
    })
  }
  return request<KbDocumentDetail>(`${KB_BASE}/document/${id}`, { method: 'GET' })
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
  return request<KbAttachment>(`${KB_BASE}/attachment/upload`, { method: 'POST', body: form })
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
