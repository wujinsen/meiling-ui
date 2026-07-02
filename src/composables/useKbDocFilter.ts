import { computed, ref, watch, type Ref } from 'vue'
import { getKbIndexApi, getKbIndexTypesApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbDocumentSearchParams, KbIndexGroup, KbIndexTypeFacetItem } from '@/types/knowledge'

/** 分类 chip：all=不过滤，uncategorized=未分类，其余为 categoryId */
export type KbCategoryFilter = 'all' | 'uncategorized' | string

export type KbCategoryChip = {
  type: string
  label: string
  count: number
}

/** 体裁 + 分类两个独立维度（AND），进页即拉全空间 facet */
export function useKbDocFilter(spaceId: Ref<string | number | undefined>) {
  const kbTypeFilter = ref<string | null>(null)
  const categoryFilter = ref<KbCategoryFilter>('all')

  const kbTypeChips = ref<KbIndexTypeFacetItem[]>([])
  const kbTypeLoading = ref(false)
  const categoryGroups = ref<KbIndexGroup[]>([])
  const indexTotal = ref(0)
  const indexLoading = ref(false)

  const categoryChips = computed((): KbCategoryChip[] =>
    categoryGroups.value.map((g) => ({
      type: g.type,
      label: g.label,
      count: Number(g.count ?? g.items?.length ?? 0) || 0,
    })),
  )

  const filtersLoading = computed(() => kbTypeLoading.value || indexLoading.value)

  async function loadKbTypeChips() {
    if (!spaceId.value) {
      kbTypeChips.value = []
      return
    }
    kbTypeLoading.value = true
    try {
      // 体裁 facet 始终按全空间计数（API §2.1.3 进页不带 categoryId）
      const res = await getKbIndexTypesApi({ spaceId: spaceId.value })
      if (res.code === API_SUCCESS_CODE && res.data) {
        kbTypeChips.value = res.data.items
        if (kbTypeFilter.value && !res.data.items.some((c) => c.kbType === kbTypeFilter.value)) {
          kbTypeFilter.value = null
        }
      } else {
        kbTypeChips.value = []
      }
    } catch {
      kbTypeChips.value = []
    } finally {
      kbTypeLoading.value = false
    }
  }

  async function loadCategoryIndex() {
    if (!spaceId.value) {
      categoryGroups.value = []
      indexTotal.value = 0
      return
    }
    indexLoading.value = true
    try {
      const res = await getKbIndexApi(spaceId.value)
      if (res.code === API_SUCCESS_CODE && res.data) {
        categoryGroups.value = res.data.groups
        indexTotal.value = res.data.total ?? 0
        const types = new Set(categoryGroups.value.map((g) => g.type))
        if (categoryFilter.value !== 'all' && !types.has(categoryFilter.value)) {
          categoryFilter.value = 'all'
        }
      } else {
        categoryGroups.value = []
        indexTotal.value = 0
      }
    } catch {
      categoryGroups.value = []
      indexTotal.value = 0
    } finally {
      indexLoading.value = false
    }
  }

  async function reloadFilters() {
    await Promise.all([loadKbTypeChips(), loadCategoryIndex()])
  }

  function applySearchParams(params: KbDocumentSearchParams) {
    if (kbTypeFilter.value) params.kbType = kbTypeFilter.value
    if (categoryFilter.value === 'uncategorized') {
      params.uncategorizedOnly = true
    } else if (categoryFilter.value !== 'all') {
      params.categoryId = categoryFilter.value
    }
    return params
  }

  function selectKbType(value: string | null) {
    kbTypeFilter.value = value
  }

  function selectCategory(value: KbCategoryFilter) {
    categoryFilter.value = value
  }

  function resetFilters() {
    kbTypeFilter.value = null
    categoryFilter.value = 'all'
  }

  watch(spaceId, () => {
    resetFilters()
    void reloadFilters()
  }, { immediate: true })

  return {
    kbTypeFilter,
    categoryFilter,
    kbTypeChips,
    kbTypeLoading,
    categoryGroups,
    categoryChips,
    indexTotal,
    indexLoading,
    filtersLoading,
    reloadFilters,
    applySearchParams,
    selectKbType,
    selectCategory,
    resetFilters,
  }
}
