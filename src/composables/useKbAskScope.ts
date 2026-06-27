import type { KbAskRequest } from '@/types/knowledge'

export type KbAskScopeMode = 'all' | 'custom'

const MODE_KEY = 'kb_ask_scope_mode'
const IDS_KEY = 'kb_ask_scope_ids'

export function readKbAskScopeMode(): KbAskScopeMode {
  try {
    const raw = sessionStorage.getItem(MODE_KEY)
    return raw === 'custom' ? 'custom' : 'all'
  } catch {
    return 'all'
  }
}

export function readKbAskScopeIds(): string[] {
  try {
    const raw = sessionStorage.getItem(IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function persistKbAskScope(mode: KbAskScopeMode, ids: string[]) {
  try {
    sessionStorage.setItem(MODE_KEY, mode)
    sessionStorage.setItem(IDS_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

/** 构建问答 API 空间参数：all → 省略；单选 → spaceId；多选 → spaceIds */
export function buildKbAskScopePayload(
  mode: KbAskScopeMode,
  ids: string[],
): Pick<KbAskRequest, 'spaceId' | 'spaceIds'> {
  if (mode === 'all') return {}
  if (!ids.length) return {}
  if (ids.length === 1) return { spaceId: ids[0] }
  return { spaceIds: [...ids] }
}

/** 历史记录仅支持单 spaceId；多选时不传 */
export function buildKbAskHistoryScope(
  mode: KbAskScopeMode,
  ids: string[],
): Pick<{ spaceId?: string }, 'spaceId'> {
  if (mode !== 'custom' || ids.length !== 1) return {}
  return { spaceId: ids[0] }
}
