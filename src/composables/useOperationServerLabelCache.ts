import { shallowRef } from 'vue'
import { getServerApi } from '@/api/operation'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationComponent, OperationProject, OperationServer } from '@/types/operation'
import { resolveEntityServerIds } from '@/utils/operationServerLinks'

type LinkedEntity = Pick<OperationProject | OperationComponent, 'id' | 'serverId' | 'serverIds'>

export function useOperationServerLabelCache() {
  const serverCache = shallowRef(new Map<string, OperationServer>())

  function cacheServer(srv: OperationServer) {
    if (srv.id == null) return
    const next = new Map(serverCache.value)
    next.set(String(srv.id), srv)
    serverCache.value = next
  }

  async function enrichRowsWithLinks<T extends LinkedEntity>(
    rows: T[],
    fetchLinks: (id: string | number) => Promise<(number | string)[] | undefined>,
  ): Promise<T[]> {
    const targets = rows.filter((row) => row.id != null)
    if (!targets.length) return rows

    const patch = new Map<string, (number | string)[]>()
    await Promise.all(
      targets.map(async (row) => {
        try {
          const serverIds = await fetchLinks(row.id!)
          if (serverIds !== undefined) patch.set(String(row.id), serverIds)
        } catch {
          /* ignore */
        }
      }),
    )
    if (!patch.size) return rows

    return rows.map((row) => {
      if (!patch.has(String(row.id))) return row
      const serverIds = patch.get(String(row.id))!
      if (!serverIds.length) {
        return { ...row, serverIds: undefined, serverId: undefined }
      }
      return { ...row, serverIds, serverId: serverIds[0] }
    })
  }

  async function hydrateRows(rows: LinkedEntity[]) {
    const missing = new Set<string>()
    for (const row of rows) {
      for (const id of resolveEntityServerIds(row.serverIds, row.serverId)) {
        if (!serverCache.value.has(id)) missing.add(id)
      }
    }
    if (!missing.size) return

    await Promise.all(
      [...missing].map(async (id) => {
        try {
          const result = await getServerApi(id)
          if (result.code === API_SUCCESS_CODE && result.data) cacheServer(result.data)
        } catch {
          /* ignore */
        }
      }),
    )
  }

  return { serverCache, cacheServer, enrichRowsWithLinks, hydrateRows }
}
