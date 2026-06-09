import { onMounted, reactive, ref, watch } from 'vue'
import { getPersonaOverviewApi, getPersonaUserDetailApi } from '@/api/persona'
import { buildMockPersonaOverview } from '@/composables/personaMock'
import { API_SUCCESS_CODE } from '@/types/api'
import type { PersonaOverview, PersonaQuery, PersonaUserDetail } from '@/types/persona'

export function usePersona() {
  const loading = ref(false)
  const overview = ref<PersonaOverview | null>(null)

  const filters = reactive<PersonaQuery>({
    range: '30d',
    segmentId: '',
    risk: '',
    search: '',
  })

  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const detail = ref<PersonaUserDetail | null>(null)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  async function load() {
    loading.value = true
    const q = { ...filters }
    try {
      const result = await getPersonaOverviewApi(q)
      if (result.code === API_SUCCESS_CODE && result.data) {
        overview.value = result.data
      } else {
        overview.value = buildMockPersonaOverview(q)
      }
    } catch {
      overview.value = buildMockPersonaOverview(q)
    } finally {
      loading.value = false
    }
  }

  async function openUser(userId: string) {
    detailOpen.value = true
    detailLoading.value = true
    detail.value = null
    try {
      const result = await getPersonaUserDetailApi(userId)
      if (result.code === API_SUCCESS_CODE && result.data) {
        detail.value = result.data
      }
    } finally {
      detailLoading.value = false
    }
  }

  function closeDetail() {
    detailOpen.value = false
    detail.value = null
  }

  function setSegment(segmentId: string) {
    filters.segmentId = filters.segmentId === segmentId ? '' : segmentId
    load()
  }

  watch(
    () => [filters.range, filters.risk] as const,
    () => load(),
  )

  watch(
    () => filters.search,
    () => {
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(load, 320)
    },
  )

  onMounted(load)

  return {
    loading,
    overview,
    filters,
    detailOpen,
    detailLoading,
    detail,
    load,
    openUser,
    closeDetail,
    setSegment,
  }
}
