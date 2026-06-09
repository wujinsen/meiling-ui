import { ref } from 'vue'
import type { BiChannelKey } from '@/types/bi'
import { useBiQuery } from '@/composables/useBiQuery'

const isOpen = ref(false)

export function useAnalyticsFilters() {
  const { query, applyFilters, resetChannels } = useBiQuery()

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function close() {
    isOpen.value = false
  }

  function apply() {
    applyFilters()
    close()
  }

  function setChannel(key: BiChannelKey, on: boolean) {
    query.channels[key] = on
  }

  return {
    isOpen,
    channels: query.channels,
    toggle,
    close,
    apply,
    resetChannels,
    setChannel,
  }
}
