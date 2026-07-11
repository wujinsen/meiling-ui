import type { OperationComponent, OperationProject } from '@/types/operation'
import { isOperationOrphan } from '@/utils/operationOrphan'

export function normalizeServerIds(ids?: (string | number)[]) {
  if (!ids?.length) return undefined
  const out = ids.map((id) => String(id).trim()).filter(Boolean)
  return out.length ? out : undefined
}

export function resolveEntityServerIds(
  serverIds?: (string | number)[],
  serverId?: string | number | null,
) {
  if (serverIds?.length) return serverIds.map(String)
  if (serverId != null && serverId !== '') return [String(serverId)]
  return []
}

export function entityHasServer(row: Pick<OperationProject | OperationComponent, 'serverId' | 'serverIds'>) {
  return (row.serverIds?.length ?? 0) > 0 || !isOperationOrphan(row.serverId)
}

export function linkedServerCount(row: Pick<OperationProject | OperationComponent, 'serverId' | 'serverIds'>) {
  const n = row.serverIds?.length ?? 0
  if (n > 0) return n
  return isOperationOrphan(row.serverId) ? 0 : 1
}
