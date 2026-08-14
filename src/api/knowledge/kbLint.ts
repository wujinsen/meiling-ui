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
import { getToken } from '@/utils/authSession'
import { KB_BASE, USE_MOCK, buildQuery, delay, normalizeKbPageRecords, ok } from './core'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

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

function paginateLintIssuesClientSide(
  rows: KbLintIssue[],
  params?: KbLintIssueQuery,
  totalHint?: number,
): MoliPage<KbLintIssue> {
  // 裸数组 / 无 current+size 时客户端分页；unassignedOnly 由 filterMockIssues 或调用方预过滤
  const pageNum = Math.max(1, params?.pageNum ?? 1)
  const pageSize = Math.max(1, params?.pageSize ?? (rows.length || 10))
  const start = (pageNum - 1) * pageSize
  return {
    records: rows.slice(start, start + pageSize),
    total: totalHint ?? rows.length,
    current: pageNum,
    size: pageSize,
  }
}

function normalizeLintIssuesResponse(
  data: KbLintIssue[] | MoliPage<KbLintIssue> | Record<string, unknown> | null | undefined,
  params?: KbLintIssueQuery,
): MoliPage<KbLintIssue> {
  if (Array.isArray(data)) {
    const filtered = params?.unassignedOnly ? (data as KbLintIssue[]).filter((r) => r.assigneeId == null) : (data as KbLintIssue[])
    return paginateLintIssuesClientSide(filtered, params)
  }
  const raw = (data ?? {}) as Record<string, unknown>
  const page = normalizeKbPageRecords<KbLintIssue>(data as MoliPage<KbLintIssue>)
  const serverPaginated = raw.current != null && raw.size != null
  if (serverPaginated) {
    return {
      records: page.records,
      total: page.total,
      current: Number(raw.current),
      size: Number(raw.size),
    }
  }
  return paginateLintIssuesClientSide(page.records, params, page.total)
}

/** GET /kb/lint —— DB 快照体检 */
export async function getKbLintApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(220)
    return ok<KbLintReport>(mockLint())
  }
  return request<KbLintReport>(`${KB_BASE}/lint${buildQuery({ spaceId })}`, { method: 'GET' })
}

/** POST /kb/lint/scan —— 扫描并落库（全库扫描 + 写 kb_lint_issue，大空间可能 >8s） */
export async function scanKbLintApi(spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(700)
    return ok<KbLintReport>(mockLint())
  }
  return request<KbLintReport>(`${KB_BASE}/lint/scan${buildQuery({ spaceId })}`, {
    method: 'POST',
    timeoutMs: 120_000,
  })
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
  const path = `${KB_BASE}/lint/scan/status${buildQuery({ spaceId })}`
  const headers: HeadersInit = {}
  const token = getToken()
  if (token) headers.Authorization = token
  const httpRes = await fetch(`${API_BASE}${path}`, { method: 'GET', headers })
  if (httpRes.status === 404) {
    const issuesRes = await getKbLintIssuesApi({ spaceId, status: 0, pageNum: 1, pageSize: 1 })
    const openCount =
      issuesRes.code === API_SUCCESS_CODE ? Number(issuesRes.data?.total) || 0 : undefined
    return ok<KbLintScanStatus>({
      spaceId,
      scheduleEnabled: false,
      openIssueCount: openCount,
    })
  }
  const text = await httpRes.text()
  let res: MoliResult<KbLintScanStatus>
  try {
    res = JSON.parse(text) as MoliResult<KbLintScanStatus>
  } catch {
    return { code: httpRes.status, msg: 'Invalid response', data: undefined }
  }
  if (res.code === API_SUCCESS_CODE && res.data) return res
  return res
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

function toBatchRequestBody(payload: KbLintIssueBatchUpdate): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ids: payload.ids.map((id) => String(id)),
  }
  if (payload.status != null) body.status = payload.status
  if (payload.assigneeId === null) {
    body.clearAssignee = true
  } else if (payload.assigneeId !== undefined && payload.assigneeId !== '') {
    body.assigneeId = String(payload.assigneeId)
  }
  return body
}

function batchResultFromCount(
  ids: Array<number | string>,
  updated: number,
  code: number,
  msg?: string,
) {
  const okCount = Math.max(0, updated)
  const failCount = Math.max(0, ids.length - okCount)
  return {
    code: failCount ? 500 : code,
    msg: failCount ? msg ?? `${failCount} failed` : msg ?? 'ok',
    data: { okCount, failCount, results: [] as { id: number | string; ok: boolean; msg?: string }[] },
  }
}

/** O7/O8：PUT /kb/lint/issues/batch —— 批量改状态 / 指派 */
export async function batchUpdateKbLintIssuesApi(payload: KbLintIssueBatchUpdate) {
  const { ids, status, assigneeId } = payload
  if (!ids.length) {
    return batchResultFromCount(ids, 0, API_SUCCESS_CODE)
  }

  if (USE_MOCK) {
    await delay(180)
    let updated = 0
    for (const id of ids) {
      const row = MOCK_ISSUES.find((r) => String(r.id) === String(id))
      if (!row) continue
      if (status != null) row.status = status
      if (assigneeId !== undefined) row.assigneeId = assigneeId
      updated++
    }
    return batchResultFromCount(ids, updated, API_SUCCESS_CODE)
  }

  const res = await request<number>(`${KB_BASE}/lint/issues/batch`, {
    method: 'PUT',
    body: JSON.stringify(toBatchRequestBody(payload)),
  })
  if (res.code !== API_SUCCESS_CODE) {
    return batchResultFromCount(ids, 0, res.code, res.msg)
  }
  return batchResultFromCount(ids, Number(res.data) || 0, API_SUCCESS_CODE, res.msg)
}
