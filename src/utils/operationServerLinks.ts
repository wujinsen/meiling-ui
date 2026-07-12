import type { LinkedServerRow, OperationComponent, OperationProject, OperationServer } from '@/types/operation'
import { isOperationOrphan } from '@/utils/operationOrphan'

export function formatOperationServerLabel(srv: Pick<OperationServer, 'serverName' | 'ip' | 'innerIp'>) {
  const ip = srv.innerIp || srv.ip || '-'
  return `${srv.serverName || ip} · ${ip}`
}

export function resolvePrimaryServerLabel(row: LinkedServerRow, cache?: ReadonlyMap<string, OperationServer>) {
  const ids = resolveEntityServerIds(row.serverIds, row.serverId)
  const primaryId = ids[0]
  if (primaryId && cache?.has(primaryId)) {
    return formatOperationServerLabel(cache.get(primaryId)!)
  }
  if (!isOperationOrphan(row.serverId) || row.serverIp || row.innerIp) {
    const ip = row.innerIp || row.serverIp
    if (ip) return ip
  }
  return null
}

export function applyServerIdsToLinkedRow<T extends LinkedServerRow>(
  row: T,
  serverIds: string[],
  cache?: ReadonlyMap<string, OperationServer>,
): T {
  const ids = serverIds.map(String).filter(Boolean)
  if (!ids.length) {
    return { ...row, serverIds: undefined, serverId: '' }
  }
  const primary = cache?.get(ids[0])
  return {
    ...row,
    serverIds: ids,
    serverId: ids[0],
    serverIp: primary ? (primary.ip || primary.innerIp || row.serverIp) : row.serverIp,
    innerIp: primary?.innerIp ?? row.innerIp,
  }
}

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
