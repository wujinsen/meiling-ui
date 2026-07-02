/** 浏览/筛选 API 的空间范围：空数组 = 全部可读空间 */
export type KbSpaceScopeParams = {
  spaceId?: string
  spaceIds?: string[]
}

export function toKbSpaceScopeParams(selectedIds: string[]): KbSpaceScopeParams {
  if (selectedIds.length === 0) return {}
  if (selectedIds.length === 1) return { spaceId: selectedIds[0] }
  return { spaceIds: selectedIds }
}

export function applyKbSpaceScopeParams<T extends KbSpaceScopeParams>(
  target: T,
  selectedIds: string[],
): T {
  const scope = toKbSpaceScopeParams(selectedIds)
  if (scope.spaceId) target.spaceId = scope.spaceId
  else delete target.spaceId
  if (scope.spaceIds?.length) target.spaceIds = scope.spaceIds
  else delete target.spaceIds
  return target
}
