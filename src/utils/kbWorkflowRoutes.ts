/** KBOPS 闭环：治理 / 体检 / Ingest / LLM 页面跳转（保留 spaceId query 供目标页读取） */

export type KbWorkflowTab = 'lint' | 'sync'

export function kbLintRoute(opts?: { tab?: KbWorkflowTab; spaceId?: string | number | null }) {
  const query: Record<string, string> = {}
  if (opts?.tab === 'sync') query.tab = 'sync'
  const sid = opts?.spaceId != null ? String(opts.spaceId) : ''
  if (sid) query.spaceId = sid
  return { path: '/knowledge/lint', query }
}

export function kbIngestRoute(spaceId?: string | number | null) {
  const query: Record<string, string> = {}
  const sid = spaceId != null ? String(spaceId) : ''
  if (sid) query.spaceId = sid
  return { path: '/knowledge/ingest', query }
}

export function kbWikiGovernRoute(spaceId?: string | number | null) {
  const query: Record<string, string> = {}
  const sid = spaceId != null ? String(spaceId) : ''
  if (sid) query.spaceId = sid
  return { path: '/knowledge/wiki-govern', query }
}

/** 平台 LLM 配置（菜单 SQL：parent 900 · path kb-llm · name KbPlatformLlmSettings） */
export function kbLlmSettingsRoute() {
  return { name: 'KbPlatformLlmSettings' as const }
}

export function kbOpsDashboardRoute() {
  return { path: '/knowledge/ops/dashboard', query: {} as Record<string, string> }
}
