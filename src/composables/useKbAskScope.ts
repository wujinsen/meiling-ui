import type { KbAskRequest } from '@/types/knowledge'
import { toKbSpaceScopeParams } from '@/utils/kbSpaceScope'

/** @deprecated 与 useKbSpaceScope 统一；保留类型供旧存储迁移 */
export type KbAskScopeMode = 'all' | 'custom'

/** 构建问答 API 空间参数：空数组 = 全部可读空间 */
export function buildKbAskScopePayload(
  scopeSpaceIds: string[],
): Pick<KbAskRequest, 'spaceId' | 'spaceIds'> {
  return toKbSpaceScopeParams(scopeSpaceIds)
}

/** 历史记录仅支持单 spaceId；多选/全部时不传 */
export function buildKbAskHistoryScope(
  scopeSpaceIds: string[],
): Pick<{ spaceId?: string }, 'spaceId'> {
  if (scopeSpaceIds.length === 1) return { spaceId: scopeSpaceIds[0] }
  return {}
}
