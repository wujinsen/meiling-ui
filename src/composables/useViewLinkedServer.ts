import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/composables/useToast'
import type { LinkedServerRow, OperationServer } from '@/types/operation'
import { linkedServerCount, resolveEntityServerIds } from '@/utils/operationServerLinks'

export function useViewLinkedServer(serverCache: Ref<ReadonlyMap<string, OperationServer>>) {
  const { t } = useI18n()

  const detailOpen = ref(false)
  const detailServerId = ref<string | number | null>(null)
  const pickOpen = ref(false)
  const pickServerIds = ref<string[]>([])

  function openDetail(id: string | number) {
    detailServerId.value = id
    detailOpen.value = true
  }

  function closeDetail() {
    detailOpen.value = false
    detailServerId.value = null
  }

  function closePick() {
    pickOpen.value = false
    pickServerIds.value = []
  }

  function onPickServer(id: string) {
    closePick()
    openDetail(id)
  }

  function openFromRow(row: LinkedServerRow, scope: 'primary' | 'all') {
    const ids = resolveEntityServerIds(row.serverIds, row.serverId)
    if (!ids.length) {
      const ip = row.innerIp || row.serverIp
      if (ip) {
        showToast('error', t('operation.server.orphanIpOnly', { ip }))
      } else {
        showToast('error', t('operation.server.noLinkedServer'))
      }
      return
    }
    if (scope === 'all' && linkedServerCount(row) > 1) {
      pickServerIds.value = ids
      pickOpen.value = true
      return
    }
    openDetail(ids[0])
  }

  return {
    detailOpen,
    detailServerId,
    pickOpen,
    pickServerIds,
    openFromRow,
    closeDetail,
    closePick,
    onPickServer,
  }
}
