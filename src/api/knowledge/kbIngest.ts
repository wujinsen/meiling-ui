import { request } from '@/api/http'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  KbIngestCommitResult,
  KbIngestDraft,
  KbIngestExpressStartResult,
  KbIngestGenerateResult,
  KbIngestJob,
  KbIngestJobCreateRequest,
  KbIngestJobFromTemplateRequest,
  KbIngestLint,
  KbIngestPlanUpdateRequest,
  KbIngestPrepareResult,
  KbIngestPublishResult,
  KbIngestSaveAsTemplateRequest,
  KbIngestTemplate,
  KbIngestTemplateCreateRequest,
  KbRawCoverage,
  KbRawCoverageFilter,
  KbRawTreeNode,
  MoliPage,
} from '@/types/knowledge'
import type { RawUploadConflict, RawUploadResultVo } from '@/types/kbImport'
import { extractRawPrefixSuggestions } from '@/utils/kbImport'
import {
  KB_BASE,
  USE_MOCK,
  USE_MOCK_KB_IMPORT,
  buildQuery,
  delay,
  jsonEntityBody,
  ok,
  toEntityId,
} from './core'

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
export async function generateKbIngestDraftsApi(
  id: number | string,
  opts?: { resume?: boolean; useLlmGenerate?: boolean },
) {
  const { resume = false, useLlmGenerate = true } = opts ?? {}
  return request<KbIngestGenerateResult>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/generate${buildQuery({
      resume: String(resume),
      useLlmGenerate: String(useLlmGenerate),
    })}`,
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
export async function regenerateKbIngestDraftApi(
  id: number | string,
  slug: string,
  useLlmGenerate = true,
) {
  return request<KbIngestDraft>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/draft/regenerate${buildQuery({
      slug,
      useLlmGenerate: String(useLlmGenerate),
    })}`,
    { method: 'POST', timeoutMs: 120_000 },
  )
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
export async function expressStartKbIngestApi(
  payload: KbIngestJobCreateRequest,
  opts?: { useLlmPlan?: boolean; useLlmGenerate?: boolean },
) {
  const { useLlmPlan = false, useLlmGenerate = true } = opts ?? {}
  return request<KbIngestExpressStartResult>(
    `${KB_BASE}/ingest/jobs/express${buildQuery({
      useLlmPlan: String(useLlmPlan),
      useLlmGenerate: String(useLlmGenerate),
    })}`,
    {
      method: 'POST',
      body: jsonEntityBody(payload as Record<string, unknown>),
      timeoutMs: 300_000,
    },
  )
}

/** T18 · POST /kb/ingest/jobs/{id}/prepare */
export async function prepareKbIngestApi(
  id: number | string,
  opts?: { useLlmPlan?: boolean; useLlmGenerate?: boolean },
) {
  const { useLlmPlan = false, useLlmGenerate = true } = opts ?? {}
  return request<KbIngestPrepareResult>(
    `${KB_BASE}/ingest/jobs/${toEntityId(id)}/prepare${buildQuery({
      useLlmPlan: String(useLlmPlan),
      useLlmGenerate: String(useLlmGenerate),
    })}`,
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



const RAW_UPLOAD_ALLOWED_EXT = new Set(['.md', '.markdown', '.txt'])
const RAW_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
const RAW_UPLOAD_MAX_FILES = 20

/** POST /kb/ingest/raw-upload —— T20a Raw 投喂 */
export async function uploadRawApi(
  spaceId: number | string,
  prefix: string,
  files: File[],
  onConflict: RawUploadConflict = 'SKIP',
) {
  const trimmedPrefix = prefix.trim().replace(/^\/+|\/+$/g, '')
  if (USE_MOCK_KB_IMPORT) {
    await delay(300)
    const uploaded = files.map((f, i) => ({
      path: `${trimmedPrefix}/${f.name.replace(/\.(md|markdown|txt)$/i, '')}${i > 0 ? `-${i}` : ''}.md`.replace(/\/+/g, '/'),
      size: f.size,
      overwritten: onConflict === 'OVERWRITE',
    }))
    return ok<RawUploadResultVo>({ uploaded, skipped: [], renamed: [] })
  }
  const form = new FormData()
  form.append('spaceId', String(spaceId))
  form.append('prefix', trimmedPrefix)
  form.append('onConflict', onConflict)
  files.forEach((f) => form.append('file', f))
  return request<RawUploadResultVo>(`${KB_BASE}/ingest/raw-upload`, {
    method: 'POST',
    body: form,
  })
}

export function validateRawUploadFiles(files: File[]): string | null {
  if (!files.length) return 'empty'
  if (files.length > RAW_UPLOAD_MAX_FILES) return 'tooMany'
  for (const f of files) {
    const name = f.name.toLowerCase()
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
    if (!RAW_UPLOAD_ALLOWED_EXT.has(ext)) return 'badExt'
    if (f.size > RAW_UPLOAD_MAX_BYTES) return 'tooLarge'
  }
  return null
}

/** GET /kb/ingest/raw-prefixes —— 已有 prefix 下拉；404 时回退 raw-tree 一级目录 */
export async function getRawPrefixSuggestionsApi(): Promise<string[]> {
  if (USE_MOCK_KB_IMPORT) {
    await delay(120)
    return ['test-walkthrough', 'school/fe', 'design']
  }
  const res = await request<string[] | { prefixes?: string[] }>(`${KB_BASE}/ingest/raw-prefixes`, {
    method: 'GET',
  })
  if (res.code === API_SUCCESS_CODE && res.data) {
    if (Array.isArray(res.data)) return res.data.filter(Boolean)
    const nested = (res.data as { prefixes?: string[] }).prefixes
    if (Array.isArray(nested)) return nested.filter(Boolean)
  }
  const tree = await getKbIngestRawTreeApi()
  if (tree.code === API_SUCCESS_CODE && tree.data?.length) {
    return extractRawPrefixSuggestions(tree.data)
  }
  return []
}

/** POST /kb/ingest/raw-upload/zip —— T20c zip 解压投喂 */
export async function uploadRawZipApi(
  spaceId: number | string,
  prefix: string,
  zipFile: File,
  onConflict: RawUploadConflict = 'SKIP',
) {
  const trimmedPrefix = prefix.trim().replace(/^\/+|\/+$/g, '')
  if (USE_MOCK_KB_IMPORT) {
    await delay(400)
    return ok<RawUploadResultVo>({
      uploaded: [{ path: `${trimmedPrefix}/from-zip.md`, size: zipFile.size, overwritten: false }],
      skipped: [],
      renamed: [],
    })
  }
  const form = new FormData()
  form.append('spaceId', String(spaceId))
  form.append('prefix', trimmedPrefix)
  form.append('onConflict', onConflict)
  form.append('file', zipFile)
  return request<RawUploadResultVo>(`${KB_BASE}/ingest/raw-upload/zip`, {
    method: 'POST',
    body: form,
    timeoutMs: 120_000,
  })
}

