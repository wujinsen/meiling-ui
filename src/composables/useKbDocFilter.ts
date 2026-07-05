import { computed, ref, watch, type Ref } from 'vue'
import { getKbIndexApi, getKbIndexTypesApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbBrowseScopeParams, KbDocumentSearchParams, KbIndexGroup, KbIndexTypeFacetItem } from '@/types/knowledge'
import { applyKbSpaceScopeParams } from '@/utils/kbSpaceScope'

/** 分类筛选项：categoryId 或 `uncategorized` */
export type KbCategoryFilterId = 'uncategorized' | string

export type KbCategoryChip = {
  type: string
  label: string
  count: number
}

export type UseKbDocFilterOptions = {
  /** 空数组时不拉 facet（文档管理等需先选定单空间） */
  skipWhenEmpty?: boolean
}

function appendKbTypeListParams(target: KbBrowseScopeParams, kbTypes: string[]) {
  if (kbTypes.length === 1) target.kbType = kbTypes[0]
  else if (kbTypes.length > 1) target.kbTypes = [...kbTypes]
}

function appendCategoryListParams(
  target: { categoryId?: string | number; categoryIds?: Array<string | number>; uncategorizedOnly?: boolean },
  categoryFilters: string[],
) {
  const ids = categoryFilters.filter((id) => id !== 'uncategorized')
  const withUncategorized = categoryFilters.includes('uncategorized')
  if (withUncategorized) {
    target.uncategorizedOnly = true
    // 单值 categoryId 与 uncategorizedOnly 同传会 400；改用 categoryIds 列表组合
    if (ids.length >= 1) target.categoryIds = [...ids]
  } else if (ids.length === 1) {
    target.categoryId = ids[0]
  } else if (ids.length > 1) {
    target.categoryIds = [...ids]
  }
}

/** 体裁 + 分类两个独立维度（维度内 OR、维度间 AND）；scopeSpaceIds 空数组 = 全部可读空间 */
export function useKbDocFilter(
  scopeSpaceIds: Ref<string[]>,
  options: UseKbDocFilterOptions = {},
) {
  const kbTypeFilters = ref<string[]>([])
  const categoryFilters = ref<KbCategoryFilterId[]>([])

  const kbTypeChips = ref<KbIndexTypeFacetItem[]>([])
  const kbTypeLoading = ref(false)
  const categoryGroups = ref<KbIndexGroup[]>([])
  const indexTotal = ref(0)
  const indexLoading = ref(false)

  const kbTypeUniverse = ref<KbIndexTypeFacetItem[]>([])
  const categoryUniverse = ref<KbIndexGroup[]>([])

  let suppressFacetWatch = false

  const groupCount = (g: KbIndexGroup) => Number(g.count ?? g.items?.length ?? 0) || 0

  const categoryChips = computed((): KbCategoryChip[] =>
    categoryGroups.value.map((g) => ({
      type: g.type,
      label: g.label,
      count: groupCount(g),
    })),
  )

  const hasActiveFilter = computed(
    () => kbTypeFilters.value.length > 0 || categoryFilters.value.length > 0,
  )

  const kbTypeChipsMerged = computed((): KbIndexTypeFacetItem[] => {
    if (!kbTypeUniverse.value.length) return kbTypeChips.value
    const counts = new Map(kbTypeChips.value.map((c) => [c.kbType, Number(c.count) || 0]))
    return kbTypeUniverse.value.map((u) => ({ ...u, count: counts.get(u.kbType) ?? 0 }))
  })

  const categoryChipsMerged = computed((): KbCategoryChip[] => {
    if (!categoryUniverse.value.length) return categoryChips.value
    const counts = new Map(categoryGroups.value.map((g) => [g.type, groupCount(g)]))
    return categoryUniverse.value.map((g) => ({
      type: g.type,
      label: g.label,
      count: counts.get(g.type) ?? 0,
    }))
  })

  const filtersLoading = computed(() => kbTypeLoading.value || indexLoading.value)

  function browseScopeParams(): KbBrowseScopeParams {
    return applyKbSpaceScopeParams({}, scopeSpaceIds.value)
  }

  function kbTypeFacetParams(): KbBrowseScopeParams {
    const params = { ...browseScopeParams() }
    appendCategoryListParams(params, categoryFilters.value)
    return params
  }

  function categoryFacetParams(): KbBrowseScopeParams {
    const params = browseScopeParams()
    appendKbTypeListParams(params, kbTypeFilters.value)
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
    appendKbTypeListParams(params, kbTypeFilters.value)
    appendCategoryListParams(params, categoryFilters.value)
    return params
  }

  function setKbTypeFilters(values: string[]) {
    kbTypeFilters.value = [...new Set(values.filter(Boolean))]
  }

  function setCategoryFilters(values: KbCategoryFilterId[]) {
    categoryFilters.value = [...new Set(values.filter(Boolean))]
  }

  function toggleKbType(kbType: string) {
    const set = new Set(kbTypeFilters.value)
    if (set.has(kbType)) set.delete(kbType)
    else set.add(kbType)
    kbTypeFilters.value = [...set]
  }

  function toggleCategory(categoryId: KbCategoryFilterId) {
    const set = new Set(categoryFilters.value)
    if (set.has(categoryId)) set.delete(categoryId)
    else set.add(categoryId)
    categoryFilters.value = [...set]
  }

  function resetFilters() {
    suppressFacetWatch = true
    kbTypeFilters.value = []
    categoryFilters.value = []
    suppressFacetWatch = false
  }

  async function refreshUniverse() {
    resetFilters()
    await reloadFilters()
    kbTypeUniverse.value = kbTypeChips.value.map((c) => ({ ...c }))
    categoryUniverse.value = categoryGroups.value.map((g) => ({ ...g }))
  }

  watch(scopeSpaceIds, () => {
    void refreshUniverse()
  }, { immediate: true, deep: true })

  watch(categoryFilters, () => {
    if (suppressFacetWatch) return
    void loadKbTypeChips()
  }, { deep: true })

  watch(kbTypeFilters, () => {
    if (suppressFacetWatch) return
    void loadCategoryIndex()
  }, { deep: true })

  return {
    kbTypeFilters,
    categoryFilters,
    kbTypeChips,
    kbTypeChipsMerged,
    kbTypeLoading,
    categoryGroups,
    categoryChips,
    categoryChipsMerged,
    indexTotal,
    indexLoading,
    filtersLoading,
    hasActiveFilter,
    reloadFilters,
    applySearchParams,
    setKbTypeFilters,
    setCategoryFilters,
    toggleKbType,
    toggleCategory,
    resetFilters,
  }
}
