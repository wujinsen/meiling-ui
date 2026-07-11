import { request } from '@/api/http'
import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type {
  KbLintIssue,
  KbLintIssueBatchUpdate,
  KbLintIssueQuery,
  KbLintIssueStatus,
  KbLintIssueUpdate,
  KbLintReport,
  KbLintScanStatus,
  MoliPage,
} from '@/types/knowledge'
import { KB_BASE, USE_MOCK, buildQuery, delay, normalizeKbPageRecords, ok } from './core'

const MOCK_ISSUES: KbLintIssue[] = [
  {
    id: 1,
    documentId: 90001,
    issueType: 'broken_link',
    detail: '断链：指向「不存在的页」',
    status: 0,
    assigneeId: null,
    scanTime: '2026-06-22 14:00:00',
  },
  {
    id: 2,
    documentId: 90020,
    issueType: 'orphan',
    detail: '孤儿页：无任何出/入链',
    status: 0,
    assigneeId: 1,
    scanTime: '2026-06-22 14:00:00',
  },
]

function mockLint(): KbLintReport {
  return {
    broken: [{ page: 'guides/a', title: 'A', target: 'missing' }],
    orphans: [{ slug: 'orphans/x', title: 'X' }],
    noSummary: [],
    counts: { pages: 10, broken: 1, orphans: 1, noSummary: 0 },
  }
}

function buildLintIssueQuery(params?: KbLintIssueQuery) {
  const q: Record<string, string | number | undefined> = {
    spaceId: params?.spaceId,
    status: params?.status,
    issueType: params?.issueType,
    assigneeId: params?.assigneeId,
    pageNum: params?.pageNum,
    pageSize: params?.pageSize,
  }
  if (params?.resolvedOnly) q.resolved = 0
  if (params?.unassignedOnly) q.unassignedOnly = 'true'
  return buildQuery(q)
}

function filterMockIssues(params?: KbLintIssueQuery): KbLintIssue[] {
  let rows = [...MOCK_ISSUES]
  if (params?.status != null) rows = rows.filter((r) => r.status === params.status)
  if (params?.issueType) rows = rows.filter((r) => r.issueType === params.issueType)
  if (params?.unassignedOnly) rows = rows.filter((r) => r.assigneeId == null)
  if (params?.assigneeId != null) rows = rows.filter((r) => String(r.assigneeId) === String(params.assigneeId))
  return rows
}

function normalizeLintIssuesResponse(
  data: KbLintIssue[] | MoliPage<KbLintIssue> | Record<string, unknown> | null | undefined,
  params?: KbLintIssueQuery,
): MoliPage<KbLintIssue> {
  if (Array.isArray(data)) {
    let rows = data as KbLintIssue[]
    if (params?.unassignedOnly) rows = rows.filter((r) => r.assigneeId == null)
    const pageNum = Math.max(1, params?.pageNum ?? 1)
    const pageSize = Math.max(1, params?.pageSize ?? (rows.length || 10))
    const start = (pageNum - 1) * pageSize
    return {
      records: rows.slice(start, start + pageSize),
      total: rows.length,
      current: pageNum,
      size: pageSize,
    }
  }
  const page = normalizeKbPageRecords<KbLintIssue>(data as MoliPage<KbLintIssue>)
  let rows = page.records
  if (params?.unassignedOnly) rows = rows.filter((r) => r.assigneeId == null)
  const pageNum = Math.max(1, params?.pageNum ?? 1)
  const pageSize = Math.max(1, params?.pageSize ?? 10)
  const start = (pageNum - 1) * pageSize
  const sliced = rows.slice(start, start + pageSize)
  return {
    records: sliced,
    total: rows.length || page.total,
    current: pageNum,
    size: pageSize,
  }
}

/** GET /kb/lint —— DB 快照体检 */
export async function getKbLintApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(220)
    return ok<KbLintReport>(mockLint())
  }
  return request<KbLintReport>(`${KB_BASE}/lint${buildQuery({ spaceId })}`, { method: 'GET' })
}

/** POST /kb/lint/scan —— 扫描并落库 */
export async function scanKbLintApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(700)
    return ok<KbLintReport>(mockLint())
  }
  return request<KbLintReport>(`${KB_BASE}/lint/scan${buildQuery({ spaceId })}`, { method: 'POST' })
}

/** GET /kb/lint/scan/status —— 定时 scan 状态（O9，只读） */
export async function getKbLintScanStatusApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(120)
    return ok<KbLintScanStatus>({
      spaceId,
      scheduleEnabled: false,
      scheduleCron: '0 0 3 ? * MON',
      lastScanTime: '2026-06-22 14:00:00',
      openIssueCount: 2,
    })
  }
  return request<KbLintScanStatus>(`${KB_BASE}/lint/scan/status${buildQuery({ spaceId })}`, { method: 'GET' })
}

/** GET /kb/lint/issues —— 工单列表（O5 筛选 + O8 分页） */
export async function getKbLintIssuesApi(params?: KbLintIssueQuery) {
  if (USE_MOCK) {
    await delay(200)
    const rows = filterMockIssues(params)
    return ok(normalizeLintIssuesResponse(rows, params))
  }
  const res = await request<KbLintIssue[] | MoliPage<KbLintIssue>>(
    `${KB_BASE}/lint/issues${buildLintIssueQuery(params)}`,
    { method: 'GET' },
  )
  if (res.code === API_SUCCESS_CODE) {
    return {
      ...res,
      data: normalizeLintIssuesResponse(res.data, params),
    } as MoliResult<MoliPage<KbLintIssue>>
  }
  return res as MoliResult<MoliPage<KbLintIssue>>
}

function patchToQuery(patch: KbLintIssueUpdate | KbLintIssueStatus): Record<string, string | number | undefined> {
  if (typeof patch === 'number') return { status: patch }
  const q: Record<string, string | number | undefined> = {}
  if (patch.status != null) q.status = patch.status
  if (patch.assigneeId != null && patch.assigneeId !== '') q.assigneeId = patch.assigneeId
  else if (patch.assigneeId === null) q.assigneeId = ''
  return q
}

/** PUT /kb/lint/issue/{id} —— 更新状态 / 指派（O6） */
export async function updateKbLintIssueApi(
  id: number | string,
  patch: KbLintIssueUpdate | KbLintIssueStatus,
) {
  if (USE_MOCK) {
    await delay(150)
    const row = MOCK_ISSUES.find((r) => String(r.id) === String(id))
    if (row && typeof patch === 'object') {
      if (patch.status != null) row.status = patch.status
      if (patch.assigneeId !== undefined) row.assigneeId = patch.assigneeId
    } else if (row && typeof patch === 'number') {
      row.status = patch
    }
    return ok<boolean>(true)
  }
  return request<boolean>(`${KB_BASE}/lint/issue/${id}${buildQuery(patchToQuery(patch))}`, { method: 'PUT' })
}

const BATCH_CONCURRENCY = 5

/** O7：后端批量 API 未就绪时，并行单条 PUT */
export async function batchUpdateKbLintIssuesApi(payload: KbLintIssueBatchUpdate) {
  const { ids, status, assigneeId } = payload
  const patch: KbLintIssueUpdate = {}
  if (status != null) patch.status = status
  if (assigneeId !== undefined) patch.assigneeId = assigneeId

  const results: { id: number | string; ok: boolean; msg?: string }[] = []
  for (let i = 0; i < ids.length; i += BATCH_CONCURRENCY) {
    const chunk = ids.slice(i, i + BATCH_CONCURRENCY)
    const settled = await Promise.all(
      chunk.map(async (id) => {
        const res = await updateKbLintIssueApi(id, patch)
        return { id, ok: res.code === API_SUCCESS_CODE, msg: res.msg }
      }),
    )
    results.push(...settled)
  }
  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount
  return {
    code: failCount ? 500 : API_SUCCESS_CODE,
    msg: failCount ? `${failCount} failed` : 'ok',
    data: { okCount, failCount, results },
  }
}
