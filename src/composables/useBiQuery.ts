import { reactive, ref } from 'vue'
import type { BiChannels, BiPeriod, BiQuery, BiRange } from '@/types/bi'

const defaultChannels = (): BiChannels => ({
  referrals: true,
  organic: true,
  social: true,
  paidAds: true,
  direct: true,
})

const query = reactive<BiQuery>({
  range: 'month',
  period: 'monthly',
  channels: defaultChannels(),
})

const revision = ref(0)

export function useBiQuery() {
  function setRange(range: BiRange) {
    query.range = range
    revision.value++
  }

  function setPeriod(period: BiPeriod) {
    query.period = period
    revision.value++
  }

  function applyFilters() {
    revision.value++
  }

  function resetChannels() {
    Object.assign(query.channels, defaultChannels())
    revision.value++
  }

  function toggleChannel(key: keyof BiChannels, on: boolean) {
    query.channels[key] = on
  }

  return {
    query,
    revision,
    setRange,
    setPeriod,
    applyFilters,
    resetChannels,
    toggleChannel,
  }
}
