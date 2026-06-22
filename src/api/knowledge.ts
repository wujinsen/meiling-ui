import { request } from '@/api/http'
import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type {
  KbAskRequest,
  KbAskResponse,
  KbGraph,
  KbIndex,
  KbLintIssue,
  KbLintIssueStatus,
  KbLintReport,
  KbPage,
} from '@/types/knowledge'

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
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
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
  return {
    nodes: [
      { id: '90001', title: '本地启动指南', type: 'guide', deg: 2 },
      { id: '90010', title: '用户中心', type: 'service', deg: 6 },
      { id: '90011', title: 'RBAC 权限模型', type: 'concept', deg: 3 },
      { id: '90020', title: 'Spring 事务', type: 'interview', deg: 1 },
    ],
    links: [
      { source: '90001', target: '90010', type: 'links_to' },
      { source: '90010', target: '90011', type: 'related' },
    ],
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
        slug: p.slug,
        title: p.title,
        kbType: p.kbType,
        snippet: p.summary,
      })),
    })
  }
  return request<KbAskResponse>(`${KB_BASE}/ask`, {
    method: 'POST',
    body: JSON.stringify(payload),
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
