import type { KbWikiLintIssue, KbWikiSpaceLintResult } from '@/types/knowledge'

/** enrich 批量修复适用的 issue kind */
export const WIKI_GOVERN_ENRICH_KINDS = new Set([
  'missing_source',
  'missing_concept',
  'missing_dates',
  'outdated',
  'no_summary',
])

/** ai-revise 默认适用（断链 / 孤儿） */
export const WIKI_GOVERN_REVISE_KINDS = new Set(['broken_link', 'orphan'])

/** 需跳转手改的结构性问题（批量 AI 跳过） */
export const WIKI_GOVERN_MANUAL_KINDS = new Set(['dup_slug', 'slug_mismatch'])

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

export function isWikiGovernManualOnly(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_MANUAL_KINDS.has(issue.kind)
}

export function isWikiGovernEnrichable(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_ENRICH_KINDS.has(issue.kind)
}

export function isWikiGovernReviseKind(issue: KbWikiLintIssue): boolean {
  return WIKI_GOVERN_REVISE_KINDS.has(issue.kind)
}

/** 除结构性问题外，均可走 AI 改稿 */
export function isWikiGovernAiFixable(issue: KbWikiLintIssue): boolean {
  return !isWikiGovernManualOnly(issue)
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
        return `补全 frontmatter 日期：${detail}。${suggest || '添加或刷新 created/updated 字段（YYYY-MM-DD）。'}`
      case 'missing_concept':
        return `补概念页或互链：${detail}。${suggest || '创建对应 concept 页或在正文添加 [[slug]]。'}`
      case 'no_summary':
        return `补全摘要或 summary：${detail}。${suggest || ''}`
      case 'outdated':
        return `更新过时内容：${detail}。${suggest || '对照 sources 刷新正文与 updated。'}`
      case 'dup_content':
      case 'near_dup':
        return `处理重复/近似正文：${detail}。${suggest || '合并到权威页、删冗余段落或加互链说明，避免多份相同正文。'}`
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
    if (!isWikiGovernAiFixable(issue)) continue
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

export function countLintErrors(result: KbWikiSpaceLintResult | null): number {
  return result?.stats?.errors ?? result?.issues.filter((i) => i.level === 'error').length ?? 0
}

export function defaultGovernBatchNo(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gov-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}
