import type { KbAccessibleSpace, KbLintIssue, KbOpsDashboardVo, KbOpsLintSummary, KbOpsSyncTrendPoint, KbSyncLog } from '@/types/knowledge'
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

export function formatDayLabel(dateKey: string, locale = 'zh-CN'): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
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
  return { syncTrend, pendingBuckets, brokenTop, openCount, llm: vo.llm }
}
