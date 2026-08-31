import type {
  KbAccessibleSpace,
  KbLintIssue,
  KbOpsDashboardVo,
  KbOpsDriftSummary,
  KbOpsEvalSummary,
  KbOpsLintSummary,
  KbOpsLlmSummary,
  KbOpsSyncTrendPoint,
  KbSyncLog,
} from '@/types/knowledge'
import { isKbSyncLogFailed } from '@/utils/kbSyncStatus'

export type KbSyncTrendDay = {
  date: string
  label: string
  success: number
  fail: number
}

export type KbPendingIssueBucket = {
  spaceId: string
  spaceName: string
  issueType: string
  count: number
}

export type KbBrokenLinkRow = {
  key: string
  detail: string
  spaceId?: string
  spaceName: string
  count: number
}

const DAY_MS = 86_400_000

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** ISO date key yyyy-MM-dd in local timezone */
export function toLocalDateKey(value: Date | string | number): string | null {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function buildLastNDayKeys(days = 7, now = new Date()): string[] {
  const keys: string[] = []
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(base.getTime() - i * DAY_MS)
    keys.push(toLocalDateKey(d)!)
  }
  return keys
}

export function formatDayLabel(dateKey?: string | null, locale = 'zh-CN'): string {
  if (dateKey == null || dateKey === '') return ''
  const key = String(dateKey)
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const dt = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(key)
  if (Number.isNaN(dt.getTime())) return key
  return dt.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })
}

/** D1 · 近 N 日 Sync 日志 success/fail 计数（按 createTime 聚合） */
export function aggregateSyncTrendByDay(logs: KbSyncLog[], days = 7, now = new Date()): KbSyncTrendDay[] {
  const keys = buildLastNDayKeys(days, now)
  const bucket = new Map(keys.map((k) => [k, { success: 0, fail: 0 }]))
  const oldest = keys[0]

  for (const row of logs) {
    const key = row.createTime ? toLocalDateKey(row.createTime) : null
    if (!key || !bucket.has(key)) continue
    if (oldest && key < oldest) continue
    const cell = bucket.get(key)!
    if (isKbSyncLogFailed(row.status)) cell.fail += 1
    else cell.success += 1
  }

  return keys.map((date) => {
    const cell = bucket.get(date)!
    return {
      date,
      label: formatDayLabel(date),
      success: cell.success,
      fail: cell.fail,
    }
  })
}

function resolveSpaceName(
  spaceId: string | number | undefined,
  spaceMap: Map<string, KbAccessibleSpace>,
): string {
  if (spaceId == null || spaceId === '') return '-'
  const key = String(spaceId)
  const hit = spaceMap.get(key)
  return hit?.spaceName || hit?.spaceCode || key
}

/** D2 · 待处理工单（status=0）按空间 + issueType 聚合 */
export function aggregatePendingIssues(
  issues: KbLintIssue[],
  spaces: KbAccessibleSpace[],
): KbPendingIssueBucket[] {
  const spaceMap = new Map(spaces.map((s) => [String(s.id), s]))
  const counts = new Map<string, KbPendingIssueBucket>()

  for (const issue of issues) {
    if (issue.status !== 0) continue
    const spaceId = issue.spaceId != null ? String(issue.spaceId) : '_unknown'
    const issueType = issue.issueType?.trim() || 'unknown'
    const compound = `${spaceId}\0${issueType}`
    const prev = counts.get(compound)
    if (prev) {
      prev.count += 1
      continue
    }
    counts.set(compound, {
      spaceId,
      spaceName: resolveSpaceName(spaceId === '_unknown' ? undefined : spaceId, spaceMap),
      issueType,
      count: 1,
    })
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.spaceName.localeCompare(b.spaceName))
}

function isBrokenLinkType(issueType?: string | null) {
  const t = issueType?.trim().toLowerCase() ?? ''
  return t === 'broken_link' || t === 'broken' || t.includes('broken')
}

/** D4 · 断链 Top N（按 detail 归并计数） */
export function topBrokenLinkIssues(
  issues: KbLintIssue[],
  spaces: KbAccessibleSpace[],
  limit = 10,
): KbBrokenLinkRow[] {
  const spaceMap = new Map(spaces.map((s) => [String(s.id), s]))
  const counts = new Map<string, KbBrokenLinkRow>()

  for (const issue of issues) {
    if (issue.status !== 0 || !isBrokenLinkType(issue.issueType)) continue
    const detail = issue.detail?.trim() || issue.issueType || '-'
    const spaceId = issue.spaceId != null ? String(issue.spaceId) : undefined
    const key = `${spaceId ?? '_'}:${detail}`
    const prev = counts.get(key)
    if (prev) {
      prev.count += 1
      continue
    }
    counts.set(key, {
      key,
      detail,
      spaceId,
      spaceName: resolveSpaceName(spaceId, spaceMap),
      count: 1,
    })
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

/** KBOPS-9 · dashboard API → D1 图表数据 */
export function mapOpsDashboardSyncTrend(
  points: KbOpsSyncTrendPoint[] | undefined,
  locale = 'zh-CN',
): KbSyncTrendDay[] {
  if (!points?.length) return []
  return points.map((row) => ({
    date: row.date,
    label: formatDayLabel(row.date, locale),
    success: row.successBatches ?? 0,
    fail: row.failBatches ?? 0,
  }))
}

/** KBOPS-9 · openByType 无空间维度时用汇总行 */
export function mapOpsDashboardPendingIssues(
  summary: KbOpsLintSummary | undefined,
  spaces: KbAccessibleSpace[],
  allSpacesLabel: string,
): KbPendingIssueBucket[] {
  const openByType = summary?.openByType ?? {}
  const entries = Object.entries(openByType)
  if (!entries.length) return []
  const defaultSpace = spaces[0]
  const spaceId = defaultSpace ? String(defaultSpace.id) : '_all'
  const spaceName = entries.length > 1 || !defaultSpace ? allSpacesLabel : (defaultSpace.spaceName || defaultSpace.spaceCode || allSpacesLabel)
  return entries
    .map(([issueType, count]) => ({
      spaceId,
      spaceName,
      issueType,
      count: Number(count) || 0,
    }))
    .sort((a, b) => b.count - a.count || a.issueType.localeCompare(b.issueType))
}

/** KBOPS-9 · topBrokenLinks 字符串列表 */
export function mapOpsDashboardBrokenTop(
  links: string[] | undefined,
  allSpacesLabel: string,
  limit = 10,
): KbBrokenLinkRow[] {
  if (!links?.length) return []
  return links.slice(0, limit).map((detail, index) => ({
    key: `dash-${index}:${detail}`,
    detail,
    spaceName: allSpacesLabel,
    count: 1,
  }))
}

/** 从 dashboard 响应填充看板（单请求路径） */
export function applyKbOpsDashboardVo(
  vo: KbOpsDashboardVo,
  spaces: KbAccessibleSpace[],
  allSpacesLabel: string,
  locale = 'zh-CN',
) {
  const syncTrend = mapOpsDashboardSyncTrend(vo.syncTrend, locale)
  const pendingBuckets = mapOpsDashboardPendingIssues(vo.lintSummary, spaces, allSpacesLabel)
  const brokenTop = mapOpsDashboardBrokenTop(vo.lintSummary?.topBrokenLinks, allSpacesLabel)
  const openCount = Number(vo.lintSummary?.openCount) || pendingBuckets.reduce((s, r) => s + r.count, 0)
  return {
    syncTrend,
    pendingBuckets,
    brokenTop,
    openCount,
    llm: vo.llm,
    retrievalQuality: vo.retrievalQuality,
    driftSummary: vo.driftSummary,
    unresolvedRelationCount: Number(vo.unresolvedRelationCount) || 0,
  }
}

export function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** hit@k / 成功率：后端 0~1 → 百分比 1 位小数 */
export function formatHitPct(value: unknown): string {
  const n = toNumberOrNull(value)
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

export function formatMrr(value: unknown): string {
  const n = toNumberOrNull(value)
  if (n == null) return '—'
  return n.toFixed(3)
}

export function formatDeltaHit(value: unknown): string {
  const n = toNumberOrNull(value)
  if (n == null) return '—'
  const pct = n * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}pp`
}

export function formatUsd(value: unknown): string {
  const n = toNumberOrNull(value)
  if (n == null) return '—'
  return `$${n.toFixed(4)}`
}

export function hasRetrievalEvalData(summary?: KbOpsEvalSummary | null): boolean {
  return Boolean(summary?.strategies?.some((row) => row.latestRunAt || row.hit3 != null))
}

/** 有调用日志字段时展示 D6；legacy / 缺表仅基础 LLM 配置时降级 */
export function hasLlmCallLogMetrics(llm?: KbOpsLlmSummary | null): boolean {
  if (!llm) return false
  if (llm.callLogEnabled === false) return false
  if (llm.callLogEnabled === true) return true
  return (
    llm.totalCalls != null
    || llm.successCalls != null
    || llm.cacheHitRate != null
    || llm.estimatedCostUsd != null
    || (llm.costTrend?.length ?? 0) > 0
    || (llm.callsByScene != null && Object.keys(llm.callsByScene).length > 0)
  )
}

export function driftSpaceSamples(summary?: KbOpsDriftSummary | null, limit = 5) {
  return (summary?.spaces ?? []).slice(0, limit)
}

/** 汇总 wiki/DB 页数（优先后端合计，旧版从 spaces 累加） */
export function resolveDriftPageTotals(summary?: KbOpsDriftSummary | null): { wiki: number; db: number } {
  if (!summary) return { wiki: 0, db: 0 }
  if (summary.wikiPageTotal != null || summary.dbKbPageTotal != null) {
    return {
      wiki: Number(summary.wikiPageTotal) || 0,
      db: Number(summary.dbKbPageTotal) || 0,
    }
  }
  return (summary.spaces ?? []).reduce(
    (acc, row) => ({
      wiki: acc.wiki + (Number(row.wikiPageCount) || 0),
      db: acc.db + (Number(row.dbKbPageCount) || 0),
    }),
    { wiki: 0, db: 0 },
  )
}

export function driftScanFailureDetail(space: KbOpsDriftSpaceSample): string | null {
  const detail = space.wikiOnly?.[0]?.detail?.trim()
  return detail?.startsWith('扫描失败:') ? detail.replace(/^扫描失败:\s*/, '') : detail || null
}

function isDriftScanFailedSpace(space: KbOpsDriftSpaceSample): boolean {
  const detail = space.wikiOnly?.[0]?.detail?.trim()
  return Boolean(detail?.startsWith('扫描失败'))
}

/** 将 GET /kb/sync/drift 多空间结果聚合为 dashboard driftSummary 形态 */
export function aggregateDriftReports(spaces: KbOpsDriftSpaceSample[]): KbOpsDriftSummary {
  const summary: KbOpsDriftSummary = {
    spaces,
    spacesScanned: spaces.length,
    spacesWithDrift: 0,
    wikiOnlyTotal: 0,
    dbOnlyTotal: 0,
    hashMismatchTotal: 0,
    inSyncTotal: 0,
    wikiPageTotal: 0,
    dbKbPageTotal: 0,
    scanFailedCount: 0,
    scanEmpty: false,
    drifted: false,
    checkedAt: new Date().toISOString(),
  }
  for (const row of spaces) {
    summary.wikiOnlyTotal! += Number(row.wikiOnlyCount) || 0
    summary.dbOnlyTotal! += Number(row.dbOnlyCount) || 0
    summary.hashMismatchTotal! += Number(row.hashMismatchCount) || 0
    summary.inSyncTotal! += Number(row.inSyncCount) || 0
    summary.wikiPageTotal! += Number(row.wikiPageCount) || 0
    summary.dbKbPageTotal! += Number(row.dbKbPageCount) || 0
    if (isDriftScanFailedSpace(row)) {
      summary.scanFailedCount! += 1
    }
    if (row.drifted) {
      summary.spacesWithDrift! += 1
    }
  }
  summary.drifted = Boolean(
    (summary.spacesWithDrift ?? 0) > 0
    || (summary.wikiOnlyTotal ?? 0) + (summary.dbOnlyTotal ?? 0) + (summary.hashMismatchTotal ?? 0) > 0,
  )
  summary.scanEmpty = Boolean(
    (summary.spacesScanned ?? 0) > 0
    && (summary.scanFailedCount ?? 0) === 0
    && (summary.wikiPageTotal ?? 0) === 0
    && (summary.dbKbPageTotal ?? 0) === 0,
  )
  return summary
}
