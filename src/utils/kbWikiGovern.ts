import type { KbWikiGovernOptions, KbWikiLintIssue, KbWikiSpaceLintResult } from '@/types/knowledge'

export const WIKI_GOVERN_SCRIPT_KINDS_FALLBACK = ['missing_dates', 'slug_mismatch', 'missing_source'] as const
export const WIKI_GOVERN_AI_KINDS_FALLBACK = [
  'broken_link',
  'bad_type',
  'missing_title',
  'orphan',
  'missing_concept',
  'outdated',
  'asym_related',
  'near_dup',
  'dup_content',
] as const
export const WIKI_GOVERN_MANUAL_KINDS_FALLBACK = ['dup_slug'] as const
export const WIKI_GOVERN_MERGE_HINT_KINDS = new Set(['dup_slug', 'dup_content', 'near_dup'])

/** @deprecated enrich 批量；治理页改用 script-fix / ai-batch-fix */
export const WIKI_GOVERN_ENRICH_KINDS = new Set([
  'missing_source',
  'missing_concept',
  'missing_dates',
  'outdated',
  'no_summary',
])

export type WikiGovernIssueGroup = {
  kind: string
  issues: KbWikiLintIssue[]
  open: boolean
}

export function wikiGovernIssueKey(issue: KbWikiLintIssue): string {
  return `${issue.page}::${issue.kind}::${issue.detail ?? ''}`
}

export function resolveScriptKinds(options: KbWikiGovernOptions | null): string[] {
  return options?.scriptFixableKinds?.length
    ? options.scriptFixableKinds
    : [...WIKI_GOVERN_SCRIPT_KINDS_FALLBACK]
}

export function resolveAiKinds(options: KbWikiGovernOptions | null): string[] {
  return options?.aiFixableKinds?.length ? options.aiFixableKinds : [...WIKI_GOVERN_AI_KINDS_FALLBACK]
}

export function resolveManualKinds(options: KbWikiGovernOptions | null): string[] {
  return options?.manualOnlyKinds?.length ? options.manualOnlyKinds : [...WIKI_GOVERN_MANUAL_KINDS_FALLBACK]
}

export function isScriptFixable(kind: string, scriptKinds: string[]) {
  return scriptKinds.includes(kind)
}

export function isAiFixable(kind: string, aiKinds: string[]) {
  return aiKinds.includes(kind)
}

export function isManualOnlyKind(kind: string, manualKinds: string[]) {
  return manualKinds.includes(kind)
}

export function isSelectableForBatch(
  issue: KbWikiLintIssue,
  options: KbWikiGovernOptions | null,
): boolean {
  if (issue.level === 'info') return false
  const scriptKinds = resolveScriptKinds(options)
  const aiKinds = resolveAiKinds(options)
  const manualKinds = resolveManualKinds(options)
  if (isManualOnlyKind(issue.kind, manualKinds)) return false
  return isScriptFixable(issue.kind, scriptKinds) || isAiFixable(issue.kind, aiKinds)
}

export function buildDefaultSelectedKeys(
  issues: KbWikiLintIssue[],
  options: KbWikiGovernOptions | null,
): Set<string> {
  const keys = new Set<string>()
  for (const issue of issues) {
    if (isSelectableForBatch(issue, options)) {
      keys.add(wikiGovernIssueKey(issue))
    }
  }
  return keys
}

export function buildSelectedIssues(all: KbWikiLintIssue[], selectedKeys: Set<string>) {
  return all.filter((i) => selectedKeys.has(wikiGovernIssueKey(i)))
}

export function fixHintKind(
  issue: KbWikiLintIssue,
  options: KbWikiGovernOptions | null,
): 'script' | 'ai' | 'manual' | 'merge' | 'other' {
  const scriptKinds = resolveScriptKinds(options)
  const aiKinds = resolveAiKinds(options)
  const manualKinds = resolveManualKinds(options)
  if (isManualOnlyKind(issue.kind, manualKinds)) return 'manual'
  if (isScriptFixable(issue.kind, scriptKinds)) return 'script'
  if (WIKI_GOVERN_MERGE_HINT_KINDS.has(issue.kind)) return 'merge'
  if (isAiFixable(issue.kind, aiKinds)) return 'ai'
  return 'other'
}

export function groupWikiLintIssues(issues: KbWikiLintIssue[]): WikiGovernIssueGroup[] {
  const map = new Map<string, KbWikiLintIssue[]>()
  for (const issue of issues) {
    const list = map.get(issue.kind) ?? []
    list.push(issue)
    map.set(issue.kind, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, groupIssues]) => ({
      kind,
      issues: groupIssues,
      open: groupIssues.some((i) => i.level !== 'info'),
    }))
}

/** dup_slug 等仅人工项 */
export function isWikiGovernManualOnly(issue: KbWikiLintIssue, options?: KbWikiGovernOptions | null): boolean {
  return isManualOnlyKind(issue.kind, resolveManualKinds(options ?? null))
}

export function summarizeFixPages(pages: Array<{ status: string }> | undefined) {
  const list = pages ?? []
  return {
    fixed: list.filter((p) => p.status === 'ok').length,
    skipped: list.filter((p) => p.status === 'skipped').length,
    failed: list.filter((p) => p.status === 'failed').length,
  }
}

export function countLintIssues(result: KbWikiSpaceLintResult | null): number {
  return result?.stats?.issues ?? result?.issues.length ?? 0
}

export function countLintErrors(result: KbWikiSpaceLintResult | null): number {
  return result?.stats?.errors ?? result?.issues.filter((i) => i.level === 'error').length ?? 0
}

/** W7：复检通过后是否允许单独 Sync（与 GovernSyncPanel 一致） */
export function isGovernSyncReady(
  result: KbWikiSpaceLintResult | null,
  strict: boolean,
): boolean {
  if (!result) return false
  const errors = countLintErrors(result)
  const issues = countLintIssues(result)
  if (strict) return issues === 0
  return errors === 0
}

export function defaultGovernBatchNo(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gov-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}
