import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getCockpitDrillApi, getCockpitOverviewApi } from '@/api/cockpit'
import { API_SUCCESS_CODE } from '@/types/api'
import type { CockpitOverview, CockpitQuery, DrillRequest, DrillRow } from '@/types/cockpit'

export function useCockpit() {
  const loading = ref(false)
  const overview = ref<CockpitOverview | null>(null)
  const error = ref<string | null>(null)

  const filters = reactive<CockpitQuery>({
    tab: 'business',
    range: '30d',
    granularity: 'week',
    region: '',
    channel: '',
    environment: '',
  })

  const drillOpen = ref(false)
  const drillTitle = ref('')
  const drillRows = ref<DrillRow[]>([])
  const drillLoading = ref(false)
  const breadcrumb = ref<string[]>([])

  let refreshTimer: ReturnType<typeof setInterval> | null = null
  const autoRefresh = ref(true)

  async function loadOverview() {
    loading.value = true
    error.value = null
    try {
      const result = await getCockpitOverviewApi({ ...filters })
      if (result.code !== API_SUCCESS_CODE || !result.data) {
        throw new Error(result.msg || 'load failed')
      }
      overview.value = result.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'load failed'
    } finally {
      loading.value = false
    }
  }

  async function openDrill(metric: string, title: string) {
    drillTitle.value = title
    breadcrumb.value = ['cockpit.breadcrumb.overview', title]
    drillOpen.value = true
    drillLoading.value = true
    try {
      const req: DrillRequest = { metric, title, filters: { ...filters } }
      const result = await getCockpitDrillApi(req)
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

  function startAutoRefresh() {
    stopAutoRefresh()
    if (!autoRefresh.value) return
    refreshTimer = setInterval(loadOverview, 60_000)
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  watch(
    () => ({ ...filters }),
    () => {
      loadOverview()
    },
    { deep: true },
  )

  watch(autoRefresh, (on) => {
    if (on) startAutoRefresh()
    else stopAutoRefresh()
  })

  onMounted(() => {
    loadOverview()
    startAutoRefresh()
  })

  onUnmounted(stopAutoRefresh)

  return {
    loading,
    overview,
    error,
    filters,
    autoRefresh,
    drillOpen,
    drillTitle,
    drillRows,
    drillLoading,
    breadcrumb,
    loadOverview,
    openDrill,
    closeDrill,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
