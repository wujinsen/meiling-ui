/**
 * 企业知识库类型 —— 对接 moli-knowledge-server（网关前缀 /KnowledgeServer）
 * 契约见 moli-project-distribute/docs/KNOWLEDGE_API.md
 */

/** 知识类型：guide/service/concept/article/interview/output（+ 兜底 other） */
export type KbType = 'guide' | 'service' | 'concept' | 'article' | 'interview' | 'output' | 'other' | string

// ---------------------------------------------------------------------------
// 2. 浏览 /kb/index、/kb/page
// ---------------------------------------------------------------------------

export type KbIndexItem = {
  id: number | string
  slug: string
  title: string
  summary?: string
  spaceId?: number | string
}

export type KbIndexGroup = {
  type: KbType
  label: string
  items: KbIndexItem[]
}

export type KbIndex = {
  total: number
  groups: KbIndexGroup[]
}

export type KbLinkRelation = 'links_to' | 'related' | 'depends_on' | 'same_tag' | string

export type KbPageLink = {
  docId: number | string
  slug: string
  title: string
  relationType?: KbLinkRelation
}

export type KbPage = {
  docId: number | string
  spaceId?: number | string
  slug: string
  title: string
  summary?: string
  /** markdown 正文 */
  content?: string
  kbType?: KbType
  domain?: string
  status?: number
  updateTime?: string
  tags?: string[]
  outLinks?: KbPageLink[]
  backLinks?: KbPageLink[]
}

// ---------------------------------------------------------------------------
// 3. Query 问答 /kb/ask
// ---------------------------------------------------------------------------

export type KbAskRequest = {
  question: string
  spaceId?: number | string
  spaceIds?: Array<number | string>
  topK?: number
}

export type KbAskMode = 'generative' | 'retrieval' | string

export type KbCitation = {
  docId: number | string
  spaceId?: number | string
  slug: string
  title: string
  kbType?: KbType
  snippet?: string
}

export type KbAskResponse = {
  answer: string
  mode: KbAskMode
  scope?: string
  scopeReason?: string
  provider?: string
  model?: string
  citations: KbCitation[]
  qaLogId?: number | string
}

export type KbQaHistory = {
  id: number | string
  spaceId?: number | string
  question: string
  answer: string
  mode?: KbAskMode
  scope?: string
  provider?: string
  model?: string
  citations?: KbCitation[]
  /** 1 有用 / 0 无用 / null 未评 */
  useful?: number | null
  createTime?: string
}

export type MoliPage<T> = {
  records: T[]
  total: number
  size: number
  current: number
  pages?: number
}

// ---------------------------------------------------------------------------
// 4.1 关系图谱 /kb/graph
// ---------------------------------------------------------------------------

export type KbGraphNode = {
  id: string
  title: string
  /** 分类名/状态，用于配色 */
  type?: string
  /** 度数，用于映射节点大小 */
  deg?: number
}

export type KbGraphLink = {
  source: string
  target: string
  /** links_to/same_tag/related/depends_on ... */
  type?: string
}

export type KbGraph = {
  nodes: KbGraphNode[]
  links: KbGraphLink[]
}

// ---------------------------------------------------------------------------
// 4.2-4.5 体检 /kb/lint、/kb/lint/scan、/kb/lint/issues
// ---------------------------------------------------------------------------

export type KbLintBroken = {
  page: string
  title: string
  target: string
}

export type KbLintSimple = {
  slug: string
  title: string
}

export type KbLintCounts = {
  pages: number
  broken: number
  orphans: number
  noSummary: number
}

export type KbLintReport = {
  broken: KbLintBroken[]
  orphans: KbLintSimple[]
  noSummary: KbLintSimple[]
  counts: KbLintCounts
}

/** 体检问题状态：0 待处理 / 1 已忽略 / 2 已修复 */
export type KbLintIssueStatus = 0 | 1 | 2

export type KbLintIssue = {
  id: number | string
  spaceId?: number | string
  documentId?: number | string
  issueType: string
  detail?: string
  status: KbLintIssueStatus
  scanTime?: string
}

// ---------------------------------------------------------------------------
// 空间 /kb/space
// ---------------------------------------------------------------------------

/** 可见性：0 私有 / 1 内部 / 2 公开 */
export type KbSpaceVisibility = 0 | 1 | 2

export type KbAccessibleSpace = {
  id: number | string
  spaceCode: string
  spaceName: string
  description?: string
  icon?: string
  visibility?: KbSpaceVisibility
  canEdit?: boolean
  canAdmin?: boolean
}

export type KbSpace = {
  id?: number | string
  spaceCode: string
  spaceName: string
  description?: string
  icon?: string
  visibility?: KbSpaceVisibility
  ownerId?: number | string
  status?: number
  sort?: number
  createTime?: string
  updateTime?: string
}

export type KbMemberRole = 'viewer' | 'editor' | 'admin'

export type KbSpaceMember = {
  id?: number | string
  spaceId: number | string
  memberType?: number
  memberId: number | string
  role: KbMemberRole
  createTime?: string
}

// ---------------------------------------------------------------------------
// 附件 / 同步 / 文档详情
// ---------------------------------------------------------------------------

export type KbAttachment = {
  id: number | string
  documentId: number | string
  fileName: string
  objectKey?: string
  fileSize?: number
  contentType?: string
  createTime?: string
}

export type KbSyncStatus = {
  batchNo?: string
  spaceId?: number | string
  lastSyncTime?: string
  total?: number
  actionCounts?: Record<string, number>
  failCount?: number
}

export type KbSyncTrigger = {
  success: boolean
  exitCode: number
  spaceCode?: string
  outputTail?: string
}

export type KbSyncLog = {
  id: number | string
  batchNo?: string
  spaceId?: number | string
  documentId?: number | string
  sourcePath?: string
  action?: string
  status?: string
  message?: string
  createTime?: string
}

export type KbDocumentDetail = {
  id: number | string
  spaceId?: number | string
  slug?: string
  title: string
  summary?: string
  content?: string
  kbType?: KbType
  domain?: string
  status?: number
  favorited?: boolean
}
