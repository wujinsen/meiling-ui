import type { KbWorkflowHintVo } from '@/types/knowledge'

/** Backend biz key / msg fragment for raw cluster commit gate (KNOWLEDGE_API · ops §2.6). */
export const INGEST_RAW_COVERAGE_BLOCKED = 'ingest.rawCoverage.blocked'

export function isIngestRawClusterConflict(message: string, apiCode?: number): boolean {
  if (message.includes(INGEST_RAW_COVERAGE_BLOCKED) || message.includes('rawCoverage.blocked')) {
    return true
  }
  const m = message.toLowerCase()
  return (
    m.includes('sources') ||
    (m.includes('raw') && (m.includes('引用') || m.includes('referenced') || m.includes('参照'))) ||
    m.includes('cluster') ||
    m.includes('enrich') ||
    m.includes('covered') ||
    (apiCode != null && apiCode !== 200 && m.includes('raw'))
  )
}

export function collectWorkflowNextSteps(
  primary?: { nextSteps?: KbWorkflowHintVo[] },
  nested?: { nextSteps?: KbWorkflowHintVo[] },
) {
  return primary?.nextSteps?.length ? primary.nextSteps : nested?.nextSteps ?? []
}
