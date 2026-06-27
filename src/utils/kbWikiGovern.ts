import type { KbWikiLintIssue, KbWikiSpaceLintResult } from '@/types/knowledge'

/** enrich 批量修复适用的 issue kind（T16b） */
export const WIKI_GOVERN_ENRICH_KINDS = new Set([
  'missing_source',
  'missing_concept',
  'missing_dates',
  'outdated',
  'no_summary',
])

/** 需跳转手改的结构性问题 */
export const WIKI_GOVERN_MANUAL_KINDS = new Set(['dup_slug', 'slug_mismatch'])

/** ai-revise 默认适用（断链 / 孤儿） */
export const WIKI_GOVERN_REVISE_KINDS = new Set(['broken_link', 'orphan'])

/** ai-revise 模式额外适用（与产品 §3.1 默认修复方式一致） */
export const WIKI_GOVERN_AI_REVISE_KINDS = new Set([
  ...WIKI_GOVERN_REVISE_KINDS,
  'missing_source',
  'missing_dates',
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
      open: true,
    }))
}

export function isWikiGovernEnrichable(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_ENRICH_KINDS.has(issue.kind)
}

export function isWikiGovernManualOnly(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_MANUAL_KINDS.has(issue.kind)
}

export function isWikiGovernReviseKind(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_REVISE_KINDS.has(issue.kind)
}

export function isWikiGovernAiReviseable(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_AI_REVISE_KINDS.has(issue.kind)
}

export function buildEnrichPatchForIssues(issues: KbWikiLintIssue[]): string {
  const lines = issues.map((issue) => {
    const detail = issue.detail?.trim() ?? ''
    const suggest = issue.suggest?.trim() ?? ''
    if (suggest) return `- **${issue.kind}**：${detail} → ${suggest}`
    return `- **${issue.kind}**：${detail || issue.page}`
  })
  return `## 治理修复\n\n${lines.join('\n')}\n`
}

export type WikiGovernEnrichTarget = {
  slug: string
  issues: KbWikiLintIssue[]
  patch: string
}

/** 按 slug 合并多条 issue，生成 enrich 目标 */
export function buildEnrichTargets(issues: KbWikiLintIssue[]): WikiGovernEnrichTarget[] {
  const map = new Map<string, KbWikiLintIssue[]>()
  for (const issue of issues) {
    if (!isWikiGovernEnrichable(issue)) continue
    const list = map.get(issue.page) ?? []
    list.push(issue)
    map.set(issue.page, list)
  }
  return [...map.entries()].map(([slug, group]) => ({
    slug,
    issues: group,
    patch: buildEnrichPatchForIssues(group),
  }))
}

export type WikiGovernReviseTarget = {
  slug: string
  issues: KbWikiLintIssue[]
  instruction: string
}

/** 按 kind 自动生成 ai-revise 指令 */
export function buildReviseInstruction(issues: KbWikiLintIssue[]): string {
  const lines = issues.map((issue) => {
    const detail = issue.detail?.trim() ?? ''
    const suggest = issue.suggest?.trim() ?? ''
    switch (issue.kind) {
      case 'broken_link':
        return `修复断链 ${detail}。${suggest || '修正 [[slug]] 链接或创建目标页，保持 frontmatter 与 sources 规范。'}`
      case 'orphan':
        return `该页为孤儿页（${detail}）。${suggest || '在相关主题页添加指向本页的 [[slug]] 互链。'}`
      case 'missing_source':
        return `补全 frontmatter sources：${detail}。${suggest || '添加可追溯的 raw/prd 引用路径。'}`
      case 'missing_dates':
        return `补全 frontmatter 日期：${detail}。${suggest || '添加或刷新 updated 字段。'}`
      case 'no_summary':
        return `补全摘要或 summary：${detail}。${suggest || ''}`
      default:
        return `修复 ${issue.kind}：${detail}。${suggest}`
    }
  })
  return [
    '请按企业知识库规范（frontmatter、[[slug]] 互链、sources）修复以下问题，输出完整 markdown 全文：',
    '',
    ...lines,
  ].join('\n')
}

/** 按 slug 合并 ai-revise 目标 */
export function buildReviseTargets(issues: KbWikiLintIssue[]): WikiGovernReviseTarget[] {
  const map = new Map<string, KbWikiLintIssue[]>()
  for (const issue of issues) {
    if (!isWikiGovernAiReviseable(issue)) continue
    const list = map.get(issue.page) ?? []
    list.push(issue)
    map.set(issue.page, list)
  }
  return [...map.entries()].map(([slug, group]) => ({
    slug,
    issues: group,
    instruction: buildReviseInstruction(group),
  }))
}

export function countLintIssues(result: KbWikiSpaceLintResult | null): number {
  return result?.stats?.issues ?? result?.issues.length ?? 0
}

export function isWikiGovernSyncReady(
  relint: KbWikiSpaceLintResult | null,
  strict: boolean,
): boolean {
  if (!relint) return false
  if (strict) return countLintIssues(relint) === 0
  return countLintErrors(relint) === 0
}

export function countLintErrors(result: KbWikiSpaceLintResult | null): number {
  return result?.stats?.errors ?? result?.issues.filter((i) => i.level === 'error').length ?? 0
}

export function defaultEnrichBatchNo(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gov-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}
