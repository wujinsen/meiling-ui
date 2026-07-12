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
  /** 体裁（document/search 列表行携带，用于侧栏徽标） */
  kbType?: KbType
}

/** GET /kb/index/types — 分类下体裁 facet（chip + 计数） */
export type KbIndexTypeFacetItem = {
  kbType: string
  label: string
  count: number
}

export type KbIndexTypesResult = {
  items: KbIndexTypeFacetItem[]
  total: number
}

/** GET /kb/meta/kb-types — 体裁白名单下拉 */
export type KbMetaKbTypeOption = {
  value: string
  label: string
}

export type KbIndexGroup = {
  /** category 模式下为 categoryId 或 `uncategorized`；legacy type 模式为 kb_type */
  type: string
  label: string
  /** meta 模式下的分组文档数 */
  count?: number
  items: KbIndexItem[]
}

export type KbIndexItemsPage = {
  type: string
  label: string
  total: number
  pageNum: number
  pageSize: number
  items: KbIndexItem[]
}

export type KbIndexLocate = {
  type: string
  label: string
  item: KbIndexItem
}

export type KbIndex = {
  total: number
  groups: KbIndexGroup[]
}

/** 浏览 facet / index API 的空间范围（空 = 全部可读空间） */
export type KbBrowseScopeParams = {
  spaceId?: number | string
  spaceIds?: Array<number | string>
  /** 单体裁（向后兼容；与 kbTypes 二选一，列表优先） */
  kbType?: string
  /** 多体裁 OR；facet 联动与 search 共用 */
  kbTypes?: string[]
  /** 单分类（向后兼容） */
  categoryId?: number | string
  /** 多分类 OR；可与 uncategorizedOnly 组合 */
  categoryIds?: Array<number | string>
  uncategorizedOnly?: boolean
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

/** GET /kb/platform/llm-config — 平台 LLM 管理视图 */
export type KbPlatformLlmConfig = {
  enabled: boolean
  provider: string
  baseUrl: string
  apiKeyConfigured: boolean
  apiKeyMask?: string
  model: string
  temperature?: number
  timeoutSeconds?: number
  extraModels?: string[]
  available: boolean
  /** database | yaml_fallback */
  source: string
  persistedInDatabase?: boolean
  /** 是否已配置 KB_LLM_CONFIG_SECRET，可加密入库 api-key */
  encryptionReady?: boolean
  updateTime?: string
}

/** PUT /kb/platform/llm-config */
export type KbPlatformLlmConfigSaveRequest = {
  enabled: boolean
  provider: string
  baseUrl: string
  /** 空字符串 = 不修改已有 key */
  apiKey?: string
  /** true = 清除 DB 中 key，运行时回退 yaml */
  clearApiKey?: boolean
  model: string
  temperature?: number
  timeoutSeconds?: number
  extraModels?: string[]
}

/** POST /kb/platform/llm-config/test */
export type KbPlatformLlmConfigTestRequest = {
  message?: string
  enabled?: boolean
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
  timeoutSeconds?: number
  extraModels?: string[]
}

export type KbPlatformLlmConfigTestResult = {
  success: boolean
  latencyMs?: number
  model?: string
  replyPreview?: string
  error?: string
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
  /** relation=读已落库边；runtime=回退运行时解析；wiki_file=直读 wiki+edges.jsonl */
  source?: 'relation' | 'runtime' | 'wiki_file'
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

/** Wiki 文件直读图谱 GET /kb/wiki/graph（wikilink + related + edges.jsonl） */
export interface KbWikiGraphParams {
  spaceId: number | string
  mode?: KbGraphMode
  maxNodes?: number
  minDeg?: number
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
  assigneeId?: number | string | null
  priority?: number
  scanTime?: string
  createTime?: string
  updateTime?: string
}

/** GET /kb/lint/issues 查询参数（O5–O8） */
export type KbLintIssueQuery = {
  spaceId?: number | string
  /** 0 待处理 / 1 已忽略 / 2 已修复 */
  status?: KbLintIssueStatus
  /** true → resolved=0（仅未关闭工单） */
  resolvedOnly?: boolean
  issueType?: string
  unassignedOnly?: boolean
  assigneeId?: number | string
  pageNum?: number
  pageSize?: number
}

export type KbLintIssueUpdate = {
  status?: KbLintIssueStatus
  assigneeId?: number | string | null
}

export type KbLintIssueBatchUpdate = {
  ids: Array<number | string>
  status?: KbLintIssueStatus
  assigneeId?: number | string | null
}

/** GET /kb/lint/scan/status —— 定时 scan 开关 + 最近落库时间（O9，只读） */
export type KbLintScanStatus = {
  spaceId?: number | string
  spaceCode?: string
  scheduleEnabled: boolean
  scheduleCron?: string
  lastScanTime?: string
  openIssueCount?: number
}

// ---------------------------------------------------------------------------
// 4.6 文件级空间 Lint（T16 · Wiki 治理工作台）
// ---------------------------------------------------------------------------

export type KbWikiLintIssueLevel = 'error' | 'warn' | 'info'

export type KbWikiLintIssue = {
  level: KbWikiLintIssueLevel
  kind: string
  page: string
  detail?: string
  suggest?: string
}

export type KbWikiSpaceLintStats = {
  pages?: number
  issues?: number
  errors?: number
  warnings?: number
  infos?: number
  by_kind?: Record<string, number>
}

export type KbWikiSpaceLintRequest = {
  spaceId?: number | string
  spaceCode?: string
  strict?: boolean
}

export type KbWikiSpaceLintResult = {
  spaceCode: string
  wikiDir: string
  stats: KbWikiSpaceLintStats
  issues: KbWikiLintIssue[]
  exitCode?: number
  outputTail?: string
}

/** GET /kb/wiki/govern/options */
export type KbWikiGovernModel = {
  id: string
  displayName?: string
}

export type KbWikiGovernOptions = {
  llmAvailable: boolean
  provider?: string
  defaultModel?: string
  models: KbWikiGovernModel[]
  scriptFixableKinds?: string[]
  aiFixableKinds?: string[]
  manualOnlyKinds?: string[]
}

export type KbWikiGovernFixRequest = {
  spaceId: number | string
  issues: KbWikiLintIssue[]
  dryRun?: boolean
}

export type KbWikiGovernPageResult = {
  slug: string
  status: 'ok' | 'skipped' | 'failed'
  kinds?: string[]
  message?: string
  previewContent?: string
}

export type KbWikiGovernScriptFixResult = {
  fixedPages: number
  skippedPages: number
  failedPages: number
  pages: KbWikiGovernPageResult[]
}

export type KbWikiGovernAiBatchFixResult = KbWikiGovernScriptFixResult & {
  model?: string
}

export type KbWikiGovernAutoFixRequest = {
  spaceId: number | string
  issues: KbWikiLintIssue[]
  model?: string
  scriptFix?: boolean
  aiFix?: boolean
  relintAfter?: boolean
  strict?: boolean
  syncAfter?: boolean
}

export type KbWikiGovernAutoFixResult = {
  issuesBefore: number
  issuesAfter?: number
  scriptFix?: KbWikiGovernScriptFixResult
  aiFix?: KbWikiGovernAiBatchFixResult
  relint?: KbWikiSpaceLintResult
  sync?: KbSyncTrigger
}

export type WikiGovernMergeHintItem = {
  kind: string
  page: string
  detail?: string
  relatedSlugs?: string[]
  canonicalSlug?: string
  cursorPrompt: string
  manualSteps?: string[]
}

export type KbWorkflowHintVo = {
  key: string
  label: string
  description?: string
  routePath: string
  routeQuery?: Record<string, string>
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

/** T22 F2：Wiki inline 插图上传结果 */
export type KbWikiAssetUpload = {
  rel: string
  fileName: string
  fileSize: number
  contentType: string
  markdown: string
}

export type KbSyncStatus = {
  batchNo?: string
  spaceId?: number | string
  lastSyncTime?: string
  total?: number
  actionCounts?: Record<string, number>
  failCount?: number
  /** KBOPS-2 后由后端返回；未返回时用本地 triggering 推断 */
  running?: boolean
  lastBatchNo?: string
  lastStatus?: 'success' | 'fail' | 'running'
  lastMessage?: string
  lastFinishTime?: string
  successCount?: number
}

export type KbSyncTrigger = {
  success: boolean
  exitCode: number
  spaceId?: number | string
  spaceCode?: string
  batchNo?: string
  status?: string
  message?: string
  outputTail?: string
  stdoutTail?: string
  nextSteps?: KbWorkflowHintVo[]
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
  categoryName?: string
  domain?: string
  source?: 'kb' | 'manual' | string
  status?: KbDocStatus
  versionNo?: number
  viewCount?: number
  updateTime?: string
  publishTime?: string
}

export type KbDocumentSearchParams = {
  spaceId?: number | string
  spaceIds?: Array<number | string>
  categoryId?: number | string
  categoryIds?: Array<number | string>
  /** 仅未分类文档（可与 categoryIds 组合 OR 含未分类） */
  uncategorizedOnly?: boolean
  keyword?: string
  status?: KbDocStatus | ''
  tagId?: number | string
  /** kb = wiki 同步文档；文档管理固定传 kb */
  source?: 'kb' | 'manual' | string
  /** 单体裁；与 kbTypes 二选一，列表优先 */
  kbType?: KbType | string
  /** 多体裁 OR；与 categoryIds 维度间 AND */
  kbTypes?: string[]
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
  icon?: string
  /** 绑定的 wiki 子目录名（分类=目录，单一真相源） */
  dirSlug?: string
  /** withCount=true 时返回该分类下文档数 */
  docCount?: number
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
  /** 绑定 wiki 子目录；创建必填，创建后不可改 */
  dirSlug?: string
  sort?: number
}

export type KbDocumentMoveResult = {
  docId: number | string
  fromSlug: string
  toSlug: string
  categoryId: number | string
  syncSuccess?: boolean
  syncOutputTail?: string
}

export type KbTagSaveRequest = {
  id?: number | string | null
  spaceId: number | string
  tagName: string
  color?: string
}

// ---------------------------------------------------------------------------
// 8. Wiki 在线编辑 /kb/wiki/page（T14a）
// ---------------------------------------------------------------------------

/** GET /kb/wiki/page —— wiki 文件全文（frontmatter+正文，权威源） */
export type KbWikiPage = {
  slug: string
  spaceId?: number | string
  spaceCode?: string
  /** wiki 文件相对路径（root 起） */
  relativePath?: string
  /** 文件全文 */
  content: string
  /** 内容 SHA-256（乐观锁/变更比对） */
  contentHash?: string
  /** 文件是否已存在（false=可新建） */
  exists: boolean
  updatedAt?: string
}

/** PUT /kb/wiki/page */
export type KbWikiSaveRequest = {
  slug: string
  spaceId?: number | string
  content: string
  changeLog?: string
  /** 打开时的 contentHash；非空时做乐观锁，冲突后端报错 */
  baselineHash?: string
}

export type KbWikiSaveResult = {
  slug: string
  spaceId?: number | string
  relativePath?: string
  created: boolean
  contentHash?: string
  savedAt?: string
}

/** POST /kb/wiki/ai-revise */
export type KbWikiAiReviseRequest = {
  slug: string
  spaceId?: number | string
  instruction: string
  baselineContent?: string
  /** 见 GET /kb/wiki/govern/options，默认 kb.llm.model */
  model?: string
  issueContext?: {
    issueType?: string
    detail?: string
  }
}

export type KbWikiAiReviseResult = {
  suggestedContent: string
  provider?: string
  model?: string
  notes?: string
}

/** POST /kb/wiki/page/lint-preview */
export type KbWikiLintPreviewRequest = {
  slug: string
  spaceId?: number | string
  content: string
}

export type KbWikiLintPreviewItem = {
  type: string
  message: string
}

export type KbWikiLintPreview = {
  issueCount: number
  issues: KbWikiLintPreviewItem[]
}

/** POST /kb/wiki/enrich */
export type KbWikiEnrichEdge = {
  from: string
  to: string
  type?: string
  evidence?: string
}

export type KbWikiEnrichItem = {
  slug: string
  patch?: string
  reason?: string
  rawPaths?: string[]
}

export type KbWikiEnrichRequest = {
  spaceId?: number | string
  batchNo?: string
  topic?: string
  slug?: string
  patch?: string
  reason?: string
  rawPaths?: string[]
  items?: KbWikiEnrichItem[]
  edges?: KbWikiEnrichEdge[]
  updateMeta?: boolean
  appendLog?: boolean
  appendIndex?: boolean
  appendEdges?: boolean
  dryRun?: boolean
  sync?: boolean
}

export type KbWikiEnrichItemResult = {
  slug: string
  patch?: string
  mergedPreview?: string
  applied?: boolean
  error?: string
}

export type KbWikiEnrichResult = {
  batchNo?: string
  topic?: string
  dryRun?: boolean
  items?: KbWikiEnrichItemResult[]
  logAppended?: boolean
  indexUpdated?: boolean
  edgesAppended?: number
  syncTriggered?: boolean
  syncResult?: KbSyncTrigger
}

/* ------------------------------------------------------------------ */
/* Ingest 工作台（T15a）                                               */
/* ------------------------------------------------------------------ */

/** GET /kb/ingest/raw-tree 节点 */
export type KbRawTreeNode = {
  name: string
  path: string
  type: 'dir' | 'file'
  size?: number
  children?: KbRawTreeNode[]
}

/** GET /kb/ingest/raw-coverage 覆盖项 */
export type KbRawCoverageItem = {
  path: string
  coverage: 'open' | 'covered' | 'cluster'
  matchKind: 'exact' | 'dir_prefix' | 'none'
  wikiSlugs: string[]
  inFlightJobIds: Array<number | string>
}

export type KbRawCoverageSummary = {
  totalFiles: number
  covered: number
  cluster: number
  open: number
}

/** GET /kb/ingest/raw-coverage */
export type KbRawCoverage = {
  spaceId: number | string
  spaceCode: string
  wikiDir: string
  indexedAt?: string
  wikiPageCount: number
  filter: 'all' | 'open' | 'covered' | 'cluster'
  summary: KbRawCoverageSummary
  items: KbRawCoverageItem[]
}

export type KbRawCoverageFilter = 'all' | 'open' | 'covered' | 'cluster'

/** POST /kb/ingest/jobs */
export type KbIngestJobCreateRequest = {
  spaceId?: number | string
  topic: string
  batchNo?: string
  expectTypes?: string
  rawPaths: string[]
  remark?: string
}

/** Ingest 批次详情 */
export type KbIngestJob = {
  id: number | string
  spaceId?: number | string
  spaceCode?: string
  batchNo?: string
  topic: string
  expectTypes?: string
  rawPaths: string[]
  status: string
  planVersion: number
  planJson?: string
  planSource?: string
  remark?: string
  canEdit?: boolean
  createTime?: string
  updateTime?: string
}

/** PUT /kb/ingest/jobs/{id}/plan */
export type KbIngestPlanUpdateRequest = {
  planJson: string
}

/** Plan JSON 结构（前端解析 planJson 后的形态） */
export type KbIngestPlanCreateItem = {
  /** 目标分类 ID（T17）；落盘目录 = kb_category.dir_slug */
  categoryId?: number | string
  type?: string
  slug?: string
  title?: string
  sources?: string[]
  reason?: string
}

export type KbIngestPlanEnrichItem = {
  slug?: string
  action?: string
  reason?: string
}

export type KbIngestPlanSkipItem = {
  raw?: string
  reason?: string
}

export type KbIngestPlanEdgeItem = {
  from?: string
  to?: string
  type?: string
  evidence?: string
}

export type KbIngestPlan = {
  batchNo?: string
  topic?: string
  create?: KbIngestPlanCreateItem[]
  enrich?: KbIngestPlanEnrichItem[]
  skip?: KbIngestPlanSkipItem[]
  edges?: KbIngestPlanEdgeItem[]
  conflicts?: string[]
}

/** Ingest 单页草稿（T15b） */
export type KbIngestDraft = {
  id: number | string
  jobId: number | string
  slug: string
  displaySlug: string
  kbType?: string
  action: 'create' | 'enrich' | string
  baseline?: string
  /** enrich 追加段落 patch（T15e） */
  patch?: string
  draft?: string
  approval: 'draft' | 'approved' | 'rejected' | string
  updateTime?: string
  /** T17a：Plan 指定分类（只读） */
  categoryId?: number | string
  dirSlug?: string
  categoryName?: string
}

/** commit/publish 簇引用冲突（code=10012） */
export type KbIngestRawConflictItem = {
  path?: string
  wikiSlugs?: string[]
  coverage?: string
}

export type KbIngestRawConflictVo = {
  conflicts?: KbIngestRawConflictItem[]
}

/** POST /kb/ingest/jobs/{id}/generate 结果（T15e 断点续跑） */
export type KbIngestGenerateResult = {
  jobId?: number | string
  total: number
  generated: number
  skipped: number
  failed?: number
  resume?: boolean
  templateMode?: boolean
  /** useLlmGenerate=true 且 LLM 不可用时后端自动降级模板 */
  llmFallback?: boolean
  llmFallbackReason?: string
  drafts: KbIngestDraft[]
}

/** T15f · POST /kb/ingest/jobs/{id}/generate/start */
export type KbIngestGenerateStartResult = {
  taskId: string
  jobId: number | string
  total: number
  resume: boolean
  templateMode?: boolean
  status: string
}

/** Ingest 批次模板（T15e） */
export type KbIngestTemplate = {
  id: number | string
  spaceId?: number | string
  spaceCode?: string
  name: string
  topic: string
  expectTypes?: string
  rawPaths: string[]
  hasPlan?: boolean
  createTime?: string
}

export type KbIngestTemplateCreateRequest = {
  spaceId?: number | string
  name: string
  topic: string
  expectTypes?: string
  rawPaths?: string[]
  planJson?: string
}

export type KbIngestJobFromTemplateRequest = {
  batchNo?: string
  topic?: string
}

export type KbIngestSaveAsTemplateRequest = {
  name: string
  includePlan?: boolean
}

/** Ingest 批次 lint 预检（T15c） */
export type KbIngestLintItem = {
  slug?: string
  type: string
  severity: 'ERROR' | 'WARN' | string
  message: string
}

export type KbIngestLint = {
  issueCount: number
  blockingCount: number
  commitReady: boolean
  issues: KbIngestLintItem[]
}

/** Ingest 落盘报告（T15c/d） */
export type KbIngestCommitResult = {
  jobId: number | string
  created: number
  updated: number
  files: string[]
  edgesAppended: number
  logAppended: boolean
  indexUpdated: boolean
  syncTriggered: boolean
  syncResult?: KbSyncTrigger
  nextSteps?: KbWorkflowHintVo[]
}

/** T18 · prepare 一步结果 */
export type KbIngestPrepareResult = {
  job: KbIngestJob
  generate: KbIngestGenerateResult
  drafts: KbIngestDraft[]
}

/** T18 · publish 一步结果 */
export type KbIngestPublishResult = {
  lint: KbIngestLint
  committed: boolean
  commit?: KbIngestCommitResult
  approvedCount: number
  nextSteps?: KbWorkflowHintVo[]
}

/** T18 · 创建 + prepare */
export type KbIngestExpressStartResult = {
  job: KbIngestJob
  prepare: KbIngestPrepareResult
}
