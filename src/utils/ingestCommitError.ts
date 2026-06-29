import type { MoliResult } from '@/types/api'
import { API_INGEST_RAW_CONFLICT_CODE } from '@/types/api'
import type { KbIngestRawConflictItem, KbIngestRawConflictVo, KbWorkflowHintVo } from '@/types/knowledge'

/** Backend biz key / msg fragment for raw cluster commit gate (KNOWLEDGE_API · ops §2.6). */
export const INGEST_RAW_COVERAGE_BLOCKED = 'ingest.rawCoverage.blocked'

export type IngestCommitFailure = {
  message: string
  apiCode?: number
  conflicts: KbIngestRawConflictItem[]
  isClusterConflict: boolean
}

function normalizeConflicts(data: unknown): KbIngestRawConflictItem[] {
  if (!data || typeof data !== 'object') return []
  const vo = data as KbIngestRawConflictVo
  if (!Array.isArray(vo.conflicts)) return []
  return vo.conflicts.filter((c) => c && (c.path || c.wikiSlugs?.length || c.coverage))
}

export function isIngestRawClusterConflict(message: string, apiCode?: number): boolean {
  if (apiCode === API_INGEST_RAW_CONFLICT_CODE) return true
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

export function parseIngestCommitFailure(res: Pick<MoliResult, 'code' | 'msg' | 'data'>): IngestCommitFailure {
  const message = res.msg?.trim() ?? ''
  const conflicts = normalizeConflicts(res.data)
  const isClusterConflict =
    res.code === API_INGEST_RAW_CONFLICT_CODE ||
    conflicts.length > 0 ||
    isIngestRawClusterConflict(message, res.code)
  return { message, apiCode: res.code, conflicts, isClusterConflict }
}

export function collectWorkflowNextSteps(
  primary?: { nextSteps?: KbWorkflowHintVo[] },
  nested?: { nextSteps?: KbWorkflowHintVo[] },
) {
  return primary?.nextSteps?.length ? primary.nextSteps : nested?.nextSteps ?? []
}
