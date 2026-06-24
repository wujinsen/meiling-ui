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
  /** meta 模式下的分组文档数 */
  count?: number
  items: KbIndexItem[]
}

export type KbIndexItemsPage = {
  type: KbType
  label: string
  total: number
  pageNum: number
  pageSize: number
  items: KbIndexItem[]
}

export type KbIndexLocate = {
  type: KbType
  label: string
  item: KbIndexItem
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
  /** 是否启用 LLM 生成式（默认 false） */
  useLlm?: boolean
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

/** GET /kb/ask/llm-config — 后端 LLM 能力探测 */
export type KbLlmConfig = {
  available: boolean
  configEnabled: boolean
  apiKeyConfigured: boolean
  provider?: string
  model?: string
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

/** /kb/graph 与 /kb/graph/ego 的统计信息（大库优化 2026-06-24） */
export type KbGraphMeta = {
  totalNodes: number
  totalLinks: number
  returnedNodes: number
  returnedLinks: number
  /** 为 true 表示后端按度数裁剪过，还有更多节点未返回 */
  truncated: boolean
  /** relation=读已落库边；runtime=回退运行时解析 */
  source?: 'relation' | 'runtime'
  mode?: 'full' | 'summary' | 'ego'
}

export type KbGraph = {
  nodes: KbGraphNode[]
  links: KbGraphLink[]
  meta?: KbGraphMeta
}

export type KbGraphMode = 'full' | 'summary'

export interface KbGraphParams {
  spaceId?: number | string
  mode?: KbGraphMode
  maxNodes?: number
  minDeg?: number
}

export interface KbGraphEgoParams {
  spaceId?: number | string
  depth?: number
  maxNodes?: number
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

export type KbSpaceRoleHint = KbMemberRole | 'owner' | 'platform'

export type KbAccessibleSpace = {
  id: number | string
  spaceCode: string
  spaceName: string
  description?: string
  icon?: string
  visibility?: KbSpaceVisibility
  canEdit?: boolean
  canAdmin?: boolean
  /** 管理页：当前用户在该空间的成员角色 */
  myRole?: KbSpaceRoleHint
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

export type KbSpaceMemberBatchAddRequest = {
  spaceId: number | string
  memberType?: number
  memberIds: Array<number | string>
  role: KbMemberRole
}

export type KbSpaceMemberBatchRemoveRequest = {
  ids: Array<number | string>
}

export type KbSpaceMemberBatchResult = {
  successCount: number
  skipCount: number
  failCount: number
  memberRowIds?: Array<number | string>
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
  categoryId?: number | string
  slug?: string
  title: string
  summary?: string
  content?: string
  kbType?: KbType
  domain?: string
  source?: 'kb' | 'manual' | string
  docType?: string
  status?: KbDocStatus
  viewCount?: number
  likeCount?: number
  versionNo?: number
  publishTime?: string
  createTime?: string
  tagIds?: Array<number | string>
  favorited?: boolean
}

/** 文档状态：0 草稿 / 1 已发布 / 2 已归档 */
export type KbDocStatus = 0 | 1 | 2

/** GET /kb/document/search 列表行 */
export type KbDocumentListItem = {
  id: number | string
  spaceId?: number | string
  categoryId?: number | string
  slug?: string
  title: string
  summary?: string
  kbType?: KbType
  domain?: string
  source?: 'kb' | 'manual' | string
  status?: KbDocStatus
  versionNo?: number
  viewCount?: number
  updateTime?: string
  publishTime?: string
}

/** POST /kb/document */
export type KbDocumentSaveRequest = {
  id?: number | string | null
  spaceId: number | string
  categoryId?: number | string
  title: string
  summary?: string
  content?: string
  docType?: string
  status?: KbDocStatus
  tagIds?: Array<number | string>
  changeLog?: string
}

export type KbDocumentSearchParams = {
  spaceId?: number | string
  spaceIds?: Array<number | string>
  categoryId?: number | string
  keyword?: string
  status?: KbDocStatus | ''
  tagId?: number | string
  pageNum?: number
  pageSize?: number
}

export type KbDocumentVersion = {
  id: number | string
  documentId?: number | string
  versionNo?: number
  title?: string
  changeLog?: string
  createId?: number | string
  createTime?: string
}

// ---------------------------------------------------------------------------
// 5.2 分类 / 5.3 标签
// ---------------------------------------------------------------------------

export type KbCategoryTree = {
  id: number | string
  spaceId?: number | string
  parentId?: number | string
  categoryName: string
  sort?: number
  children?: KbCategoryTree[]
}

export type KbCategoryFlatOption = {
  id: string
  label: string
  depth: number
}

export type KbTag = {
  id: number | string
  spaceId?: number | string
  tagName: string
  color?: string
}

export type KbCategorySaveRequest = {
  id?: number | string | null
  spaceId: number | string
  parentId?: number | string
  categoryName: string
  icon?: string
  sort?: number
}

export type KbTagSaveRequest = {
  id?: number | string | null
  spaceId: number | string
  tagName: string
  color?: string
}
