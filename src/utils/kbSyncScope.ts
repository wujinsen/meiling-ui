import type { KbSpaceQuery } from '@/composables/useKbSpace'
import type { KbAccessibleSpace } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

export type KbSyncTriggerParams = {
  spaceId?: string
  spaceCode?: string
}

/** 解析 Wiki Sync 目标空间；无明确空间时返回 null（禁止静默落默认 enterprise-kb） */
export function resolveKbSyncParams(
  scope: KbSpaceQuery,
  selectedSpace: KbAccessibleSpace | null,
): KbSyncTriggerParams | null {
  if (scope.spaceId != null && scope.spaceCode) {
    return { spaceId: scope.spaceId, spaceCode: scope.spaceCode }
  }
  if (scope.spaceCode) return { spaceCode: scope.spaceCode }
  if (selectedSpace?.spaceCode) {
    const spaceId = toEntityId(selectedSpace.id)
    return spaceId
      ? { spaceId, spaceCode: selectedSpace.spaceCode }
      : { spaceCode: selectedSpace.spaceCode }
  }
  return null
}

export function kbSyncTargetLabel(space: KbAccessibleSpace | null): string {
  if (!space) return ''
  const name = space.spaceName?.trim() || space.spaceCode
  return `${name} (${space.spaceCode})`
}
