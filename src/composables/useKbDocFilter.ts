import { computed, ref, watch, type Ref } from 'vue'
import { getKbIndexApi, getKbIndexTypesApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbBrowseScopeParams, KbDocumentSearchParams, KbIndexGroup, KbIndexTypeFacetItem } from '@/types/knowledge'
import { applyKbSpaceScopeParams } from '@/utils/kbSpaceScope'

/** 分类 chip：all=不过滤，uncategorized=未分类，其余为 categoryId */
export type KbCategoryFilter = 'all' | 'uncategorized' | string

export type KbCategoryChip = {
  type: string
  label: string
  count: number
}

export type UseKbDocFilterOptions = {
  /** 空数组时不拉 facet（文档管理等需先选定单空间） */
  skipWhenEmpty?: boolean
}

/** 体裁 + 分类两个独立维度（AND）；scopeSpaceIds 空数组 = 全部可读空间 */
export function useKbDocFilter(
  scopeSpaceIds: Ref<string[]>,
  options: UseKbDocFilterOptions = {},
) {
  const kbTypeFilter = ref<string | null>(null)
  const categoryFilter = ref<KbCategoryFilter>('all')

  const kbTypeChips = ref<KbIndexTypeFacetItem[]>([])
  const kbTypeLoading = ref(false)
  const categoryGroups = ref<KbIndexGroup[]>([])
  const indexTotal = ref(0)
  const indexLoading = ref(false)

  let suppressFacetWatch = false

  const categoryChips = computed((): KbCategoryChip[] =>
    categoryGroups.value.map((g) => ({
      type: g.type,
      label: g.label,
      count: Number(g.count ?? g.items?.length ?? 0) || 0,
    })),
  )

  const filtersLoading = computed(() => kbTypeLoading.value || indexLoading.value)

  function browseScopeParams(): KbBrowseScopeParams {
    return applyKbSpaceScopeParams({}, scopeSpaceIds.value)
  }

  /** v2：体裁 chip 随当前分类筛选联动 */
  function kbTypeFacetParams(): KbBrowseScopeParams & {
    categoryId?: string
    uncategorizedOnly?: boolean
  } {
    const params: KbBrowseScopeParams & {
      categoryId?: string
      uncategorizedOnly?: boolean
    } = { ...browseScopeParams() }
    if (categoryFilter.value === 'uncategorized') {
      params.uncategorizedOnly = true
    } else if (categoryFilter.value !== 'all') {
      params.categoryId = categoryFilter.value
    }
    return params
  }

  /** v2：分类 chip 随当前体裁筛选联动 */
  function categoryFacetParams(): KbBrowseScopeParams {
    const params = browseScopeParams()
    if (kbTypeFilter.value) params.kbType = kbTypeFilter.value
    return params
  }

  async function loadKbTypeChips() {
    if (options.skipWhenEmpty && scopeSpaceIds.value.length === 0) {
      kbTypeChips.value = []
      return
    }
    kbTypeLoading.value = true
    try {
      const res = await getKbIndexTypesApi(kbTypeFacetParams())
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
    if (options.skipWhenEmpty && scopeSpaceIds.value.length === 0) {
      categoryGroups.value = []
      indexTotal.value = 0
      return
    }
    indexLoading.value = true
    try {
      const res = await getKbIndexApi(categoryFacetParams())
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
    applyKbSpaceScopeParams(params, scopeSpaceIds.value)
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
    suppressFacetWatch = true
    kbTypeFilter.value = null
    categoryFilter.value = 'all'
    suppressFacetWatch = false
  }

  watch(scopeSpaceIds, () => {
    resetFilters()
    void reloadFilters()
  }, { immediate: true, deep: true })

  watch(categoryFilter, () => {
    if (suppressFacetWatch) return
    void loadKbTypeChips()
  })

  watch(kbTypeFilter, () => {
    if (suppressFacetWatch) return
    void loadCategoryIndex()
  })

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
