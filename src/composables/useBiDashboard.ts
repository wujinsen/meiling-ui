import { onMounted, ref, watch } from 'vue'
import { getBiDashboardApi } from '@/api/bi'
import { buildMockBiDashboard } from '@/composables/biMock'
import { API_SUCCESS_CODE } from '@/types/api'
import type { BiDashboardOverview } from '@/types/bi'
import { useBiQuery } from '@/composables/useBiQuery'

export function useBiDashboard() {
  const { query, revision } = useBiQuery()
  const loading = ref(false)
  const overview = ref<BiDashboardOverview | null>(null)

  async function load() {
    loading.value = true
    const q = { ...query, channels: { ...query.channels } }
    try {
      const result = await getBiDashboardApi(q)
      if (result.code === API_SUCCESS_CODE && result.data) {
        overview.value = result.data
      } else {
        overview.value = buildMockBiDashboard(q)
      }
    } catch {
      overview.value = buildMockBiDashboard(q)
    } finally {
      loading.value = false
    }
  }

  watch(revision, load)
  watch(() => query.period, load)
  onMounted(load)

  return { loading, overview, query, load }
}
