import { onMounted, ref, watch } from 'vue'
import { getBiAnalyticsApi, getBiDrillApi } from '@/api/bi'
import { buildMockBiAnalytics } from '@/composables/biMock'
import { API_SUCCESS_CODE } from '@/types/api'
import type { BiAnalyticsOverview, BiDrillRow } from '@/types/bi'
import { useBiQuery } from '@/composables/useBiQuery'

export function useBiAnalytics() {
  const { query, revision } = useBiQuery()
  const loading = ref(false)
  const overview = ref<BiAnalyticsOverview | null>(null)
  const error = ref<string | null>(null)

  const drillOpen = ref(false)
  const drillTitle = ref('')
  const drillRows = ref<BiDrillRow[]>([])
  const drillLoading = ref(false)
  const breadcrumb = ref<string[]>([])

  async function load() {
    loading.value = true
    error.value = null
    const q = { ...query, channels: { ...query.channels } }
    try {
      const result = await getBiAnalyticsApi(q)
      if (result.code === API_SUCCESS_CODE && result.data) {
        overview.value = result.data
        return
      }
      throw new Error(result.msg || 'load failed')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'load failed'
      overview.value = buildMockBiAnalytics(q)
    } finally {
      loading.value = false
    }
  }

  async function openDrill(metric: string, title: string) {
    drillTitle.value = title
    breadcrumb.value = ['bi.breadcrumb.analytics', title]
    drillOpen.value = true
    drillLoading.value = true
    try {
      const result = await getBiDrillApi({
        metric,
        title,
        query: { ...query, channels: { ...query.channels } },
      })
      drillRows.value = result.data ?? []
    } finally {
      drillLoading.value = false
    }
  }

  function closeDrill() {
    drillOpen.value = false
    drillRows.value = []
    breadcrumb.value = []
  }

  watch(revision, load)
  watch(
    () => query.period,
    () => load(),
  )

  onMounted(load)

  return {
    loading,
    overview,
    error,
    query,
    drillOpen,
    drillTitle,
    drillRows,
    drillLoading,
    breadcrumb,
    load,
    openDrill,
    closeDrill,
  }
}
