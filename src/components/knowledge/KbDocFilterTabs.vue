<script setup lang="ts">

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import { Check, ChevronDown, Loader2, Search, X } from 'lucide-vue-next'

import SegmentControl from '@/components/ui/SegmentControl.vue'

import { useEscapeClose } from '@/composables/useEscapeClose'

import type { KbCategoryChip, KbCategoryFilterId } from '@/composables/useKbDocFilter'

import type { KbIndexTypeFacetItem } from '@/types/knowledge'



export type KbFilterDimension = 'kbType' | 'category'



export type KbFilterAccordionItem = {

  key: string

  label: string

  count: number

  kbType: string | null

  category: KbCategoryFilterId | 'all'

}



const props = withDefaults(

  defineProps<{

    kbTypeChips: KbIndexTypeFacetItem[]

    kbTypeFilters: string[]

    kbTypeLoading?: boolean

    categoryChips: KbCategoryChip[]

    categoryFilters: KbCategoryFilterId[]

    categoryLoading?: boolean

    /** accordion=浏览侧栏手风琴；chips=管理页紧凑 chip 行；dropdown=紧凑下拉选择器 */

    layout?: 'accordion' | 'chips' | 'dropdown'

    /** chips 模式下同时展示体裁+分类两行（管理页推荐） */
    showBothRows?: boolean
    /** 浏览侧栏：列表区撑满父容器剩余高度 */
    fillHeight?: boolean
    /** accordion 模式：扁平列表（无手风琴展开，适合侧栏） */
    flatList?: boolean
    /** dropdown 模式：分类是否可用（分类为单空间概念，多空间时禁用） */
    categoryEnabled?: boolean
  }>(),
  {
    layout: 'accordion',
    showBothRows: false,
    fillHeight: false,
    flatList: false,
    categoryEnabled: true,
  },
)



const emit = defineEmits<{

  'update:kbTypeFilters': [value: string[]]

  'update:categoryFilters': [value: KbCategoryFilterId[]]

  activate: [item: KbFilterAccordionItem]

  clear: []

}>()



const { t } = useI18n()



const dimension = ref<KbFilterDimension>('kbType')

const expandedKeys = ref<Record<string, boolean>>({})

const listFilter = ref('')

const CHIP_SCROLL_THRESHOLD = 8

const LIST_SEARCH_THRESHOLD = 10



const tabOptions = computed(() => [

  { value: 'kbType', label: t('knowledge.browse.filterKbType') },

  { value: 'category', label: t('knowledge.browse.filterCategory') },

])



const sumCounts = (items: { count: number }[]) =>

  items.reduce((s, c) => s + (Number(c.count) || 0), 0)



const kbTypePanelItems = computed((): KbFilterAccordionItem[] => {

  const all: KbFilterAccordionItem = {

    key: 'kbType:__all__',

    label: t('knowledge.browse.filterAll'),

    count: sumCounts(props.kbTypeChips),

    kbType: null,

    category: 'all',

  }

  const rows = props.kbTypeChips.map((c) => ({

    key: `kbType:${c.kbType}`,

    label: c.label,

    count: Number(c.count) || 0,

    kbType: c.kbType,

    category: 'all' as const,

  }))

  return [all, ...rows]

})



const categoryPanelItems = computed((): KbFilterAccordionItem[] => {

  const all: KbFilterAccordionItem = {

    key: 'category:__all__',

    label: t('knowledge.browse.filterAll'),

    count: sumCounts(props.categoryChips),

    kbType: null,

    category: 'all',

  }

  const rows = props.categoryChips.map((c) => ({

    key: `category:${c.type}`,

    label: c.label,

    count: Number(c.count) || 0,

    kbType: null,

    category: c.type as KbCategoryFilterId,

  }))

  return [all, ...rows]

})



const panelItems = computed((): KbFilterAccordionItem[] =>

  dimension.value === 'kbType' ? kbTypePanelItems.value : categoryPanelItems.value,

)

const filteredPanelItems = computed(() => {
  const kw = listFilter.value.trim().toLowerCase()
  if (!kw) return panelItems.value
  return panelItems.value.filter((item) => item.label.toLowerCase().includes(kw))
})

const showListSearch = computed(
  () => panelItems.value.length > LIST_SEARCH_THRESHOLD
    && (props.flatList || (props.layout === 'chips' && !props.showBothRows && dimension.value === 'category')),
)

const activeKbTypeLabel = computed(() => {
  if (props.kbTypeFilters.length === 0) return null
  if (props.kbTypeFilters.length === 1) {
    const only = props.kbTypeFilters[0]
    return props.kbTypeChips.find((c) => c.kbType === only)?.label ?? only
  }
  return t('knowledge.browse.filterSelectedCount', { count: props.kbTypeFilters.length })
})

const activeCategoryLabel = computed(() => {
  if (props.categoryFilters.length === 0) return null
  if (props.categoryFilters.length === 1) {
    const only = props.categoryFilters[0]
    if (only === 'uncategorized') return t('knowledge.docManage.uncategorized')
    return props.categoryChips.find((c) => c.type === only)?.label ?? only
  }
  return t('knowledge.browse.filterSelectedCount', { count: props.categoryFilters.length })
})


/* ---------- dropdown 布局 ---------- */

const DD_SEARCH_THRESHOLD = 10

const ddRootRef = ref<HTMLElement | null>(null)
const openDimension = ref<KbFilterDimension | null>(null)
const kbTypeSearch = ref('')
const categorySearch = ref('')

useEscapeClose(
  () => openDimension.value != null,
  () => {
    openDimension.value = null
  },
)

const kbTypeTriggerLabel = computed(
  () => activeKbTypeLabel.value ?? t('knowledge.browse.filterAll'),
)

const categoryTriggerLabel = computed(
  () => activeCategoryLabel.value ?? t('knowledge.browse.filterAll'),
)

const kbTypeTriggerCount = computed(() => {
  if (props.kbTypeFilters.length !== 1) return null
  const item = kbTypePanelItems.value.find((i) => i.kbType === props.kbTypeFilters[0])
  return item?.count ?? null
})

const categoryTriggerCount = computed(() => {
  if (props.categoryFilters.length !== 1) return null
  const only = props.categoryFilters[0]
  const item = categoryPanelItems.value.find((i) => i.category === only)
  return item?.count ?? null
})

const filteredKbTypeDdItems = computed(() => {
  const kw = kbTypeSearch.value.trim().toLowerCase()
  if (!kw) return kbTypePanelItems.value
  return kbTypePanelItems.value.filter((i) => i.label.toLowerCase().includes(kw))
})

const filteredCategoryDdItems = computed(() => {
  const kw = categorySearch.value.trim().toLowerCase()
  if (!kw) return categoryPanelItems.value
  return categoryPanelItems.value.filter((i) => i.label.toLowerCase().includes(kw))
})

function toggleDd(dim: KbFilterDimension) {
  if (dim === 'category' && !props.categoryEnabled) return
  openDimension.value = openDimension.value === dim ? null : dim
}

/** 联动后交集为 0 的选项：计数弱化提示，但仍可点（不锁死组合） */
function isKbTypeDdMuted(item: KbFilterAccordionItem) {
  return item.kbType != null && item.count === 0 && !isKbTypeSelected(item)
}

function isCategoryDdMuted(item: KbFilterAccordionItem) {
  return item.category !== 'all' && item.count === 0 && !isCategorySelected(item)
}

function toggleKbTypeDd(item: KbFilterAccordionItem) {
  toggleKbTypeItem(item)
}

function toggleCategoryDd(item: KbFilterAccordionItem) {
  toggleCategoryItem(item)
}

function onDdDocumentClick(event: MouseEvent) {
  if (openDimension.value == null || !ddRootRef.value) return
  if (!ddRootRef.value.contains(event.target as Node)) openDimension.value = null
}

onMounted(() => {
  if (props.layout === 'dropdown') document.addEventListener('click', onDdDocumentClick)
})

onUnmounted(() => document.removeEventListener('click', onDdDocumentClick))



const panelLoading = computed(() =>

  dimension.value === 'kbType' ? props.kbTypeLoading : props.categoryLoading,

)



const hasActiveFilter = computed(
  () => props.kbTypeFilters.length > 0 || props.categoryFilters.length > 0,
)



function isKbTypeSelected(item: KbFilterAccordionItem) {
  if (item.kbType == null) return props.kbTypeFilters.length === 0
  return props.kbTypeFilters.includes(item.kbType)
}

function isCategorySelected(item: KbFilterAccordionItem) {
  if (item.category === 'all') return props.categoryFilters.length === 0
  return props.categoryFilters.includes(item.category)
}



function isSelected(item: KbFilterAccordionItem, dim: KbFilterDimension = dimension.value) {

  return dim === 'kbType' ? isKbTypeSelected(item) : isCategorySelected(item)

}



function isExpanded(key: string) {

  return expandedKeys.value[key] === true

}



function toggleKbTypeItem(item: KbFilterAccordionItem) {
  if (item.kbType == null) {
    emit('update:kbTypeFilters', [])
    return
  }
  const set = new Set(props.kbTypeFilters)
  if (set.has(item.kbType)) set.delete(item.kbType)
  else set.add(item.kbType)
  emit('update:kbTypeFilters', [...set])
}

function toggleCategoryItem(item: KbFilterAccordionItem) {
  if (item.category === 'all') {
    emit('update:categoryFilters', [])
    return
  }
  const set = new Set(props.categoryFilters)
  if (set.has(item.category)) set.delete(item.category)
  else set.add(item.category)
  emit('update:categoryFilters', [...set])
}



function onChipClick(item: KbFilterAccordionItem, dim: KbFilterDimension) {
  if (dim === 'kbType') toggleKbTypeItem(item)
  else toggleCategoryItem(item)
}

function onFlatListClick(item: KbFilterAccordionItem) {
  if (dimension.value === 'kbType') toggleKbTypeItem(item)
  else toggleCategoryItem(item)
  emit('activate', item)
}



/** 点整行：选中 + 展开（仅当前项展开）；已选中且已展开时再点则折叠 */

function onRowClick(item: KbFilterAccordionItem) {

  if (isSelected(item) && isExpanded(item.key)) {

    expandedKeys.value = { ...expandedKeys.value, [item.key]: false }

    return

  }

  if (dimension.value === 'kbType') toggleKbTypeItem(item)

  else toggleCategoryItem(item)

  expandedKeys.value = { [item.key]: true }

  emit('activate', item)

}



function clearFilters() {
  emit('update:kbTypeFilters', [])
  emit('update:categoryFilters', [])
  emit('clear')
}



watch(dimension, () => {
  listFilter.value = ''
  expandedKeys.value = {}

  const prefix = dimension.value === 'kbType' ? 'kbType:' : 'category:'

  const activeKey =
    dimension.value === 'kbType'
      ? props.kbTypeFilters.length === 1
        ? `${prefix}${props.kbTypeFilters[0]}`
        : props.kbTypeFilters.length > 1
          ? `${prefix}__multi__`
          : `${prefix}__all__`
      : props.categoryFilters.length === 1
        ? `${prefix}${props.categoryFilters[0]}`
        : props.categoryFilters.length > 1
          ? `${prefix}__multi__`
          : `${prefix}__all__`

  expandedKeys.value = { [activeKey]: true }

})



watch(

  () => [props.kbTypeFilters, props.categoryFilters, dimension.value] as const,

  () => {

    if (props.layout !== 'accordion' || props.flatList) return

    const prefix = dimension.value === 'kbType' ? 'kbType:' : 'category:'

    const activeKey =
      dimension.value === 'kbType'
        ? props.kbTypeFilters.length === 1
          ? `${prefix}${props.kbTypeFilters[0]}`
          : props.kbTypeFilters.length > 1
            ? `${prefix}__multi__`
            : `${prefix}__all__`
        : props.categoryFilters.length === 1
          ? `${prefix}${props.categoryFilters[0]}`
          : props.categoryFilters.length > 1
            ? `${prefix}__multi__`
            : `${prefix}__all__`

    expandedKeys.value = { [activeKey]: true }

  },

  { immediate: true },

)

</script>



<template>

  <div
    class="kb-doc-filter-tabs"
    :class="[
      layout === 'chips' && 'kb-doc-filter-tabs--chips',
      fillHeight && layout === 'accordion' && 'kb-doc-filter-tabs--fill flex min-h-0 flex-1 flex-col',
    ]"
  >

    <!-- chips · 管理页：双行 chip -->

    <template v-if="layout === 'chips'">

      <div class="flex flex-wrap items-center justify-between gap-2">

        <p v-if="showBothRows" class="text-xs text-gray-400">

          {{ t('knowledge.browse.filterHint') }}

        </p>

        <button

          v-if="hasActiveFilter"

          type="button"

          class="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300"

          @click="clearFilters"

        >

          <X class="h-3.5 w-3.5" />

          {{ t('knowledge.browse.filterClear') }}

        </button>

      </div>



      <div v-if="showBothRows" class="mt-2 space-y-2.5 border-b border-gray-100 pb-3 dark:border-white/5">

        <div class="kb-doc-filter-row">

          <span class="kb-doc-filter-row-label">{{ t('knowledge.browse.filterKbType') }}</span>

          <div class="kb-doc-filter-chip-list" :class="kbTypePanelItems.length > CHIP_SCROLL_THRESHOLD && 'kb-doc-filter-chip-list--scroll'">

            <p v-if="kbTypeLoading" class="flex items-center gap-1.5 py-1 text-xs text-gray-400">

              <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}

            </p>

            <template v-else>

              <button

                v-for="item in kbTypePanelItems"

                :key="item.key"

                type="button"

                class="kb-doc-filter-chip"

                :class="isKbTypeSelected(item) && 'kb-doc-filter-chip--active'"

                @click="onChipClick(item, 'kbType')"

              >

                <span class="truncate">{{ item.label }}</span>

                <span class="kb-doc-filter-chip-count">{{ item.count }}</span>

              </button>

            </template>

          </div>

        </div>

        <div class="kb-doc-filter-row">

          <span class="kb-doc-filter-row-label">{{ t('knowledge.browse.filterCategory') }}</span>

          <div
            class="kb-doc-filter-chip-list"
            :class="categoryPanelItems.length > CHIP_SCROLL_THRESHOLD && 'kb-doc-filter-chip-list--scroll'"
          >

            <p v-if="categoryLoading" class="flex items-center gap-1.5 py-1 text-xs text-gray-400">

              <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}

            </p>

            <template v-else>

              <button

                v-for="item in categoryPanelItems"

                :key="item.key"

                type="button"

                class="kb-doc-filter-chip"

                :class="isCategorySelected(item) && 'kb-doc-filter-chip--active'"

                @click="onChipClick(item, 'category')"

              >

                <span class="truncate">{{ item.label }}</span>

                <span class="kb-doc-filter-chip-count">{{ item.count }}</span>

              </button>

            </template>

          </div>

        </div>

      </div>



      <!-- chips · Tab 切换后展示对应标签（管理页） -->

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-gray-400">{{ t('knowledge.browse.filterHint') }}</p>
          <button
            v-if="hasActiveFilter"
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300"
            @click="clearFilters"
          >
            <X class="h-3.5 w-3.5" />
            {{ t('knowledge.browse.filterClear') }}
          </button>
        </div>

        <div v-if="hasActiveFilter && !flatList" class="mt-2 flex flex-wrap gap-1.5">
          <span v-if="activeKbTypeLabel && dimension !== 'kbType'" class="kb-doc-filter-active-pill">
            {{ t('knowledge.browse.filterKbType') }}: {{ activeKbTypeLabel }}
          </span>
          <span v-if="activeCategoryLabel && dimension !== 'category'" class="kb-doc-filter-active-pill">
            {{ t('knowledge.browse.filterCategory') }}: {{ activeCategoryLabel }}
          </span>
        </div>

        <SegmentControl v-model="dimension" :options="tabOptions" class="mt-2" />

        <div v-if="showListSearch" class="relative mt-3">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            v-model="listFilter"
            type="search"
            class="field-input w-full py-1.5 pl-8 text-xs"
            :placeholder="t('knowledge.browse.filterSearch')"
          />
        </div>

        <div
          class="kb-doc-filter-chip-list mt-3"
          :class="panelItems.length > CHIP_SCROLL_THRESHOLD && 'kb-doc-filter-chip-list--scroll'"
        >

          <p v-if="panelLoading" class="flex items-center gap-1.5 py-1 text-xs text-gray-400">

            <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}

          </p>

          <p v-else-if="!filteredPanelItems.length" class="py-4 text-center text-xs text-gray-400">
            {{ t('knowledge.browse.filterSearchEmpty') }}
          </p>

          <template v-else>

            <button

              v-for="item in filteredPanelItems"

              :key="item.key"

              type="button"

              class="kb-doc-filter-chip"

              :class="isSelected(item) && 'kb-doc-filter-chip--active'"

              @click="onChipClick(item, dimension)"

            >

              <span class="truncate">{{ item.label }}</span>

              <span class="kb-doc-filter-chip-count">{{ item.count }}</span>

            </button>

          </template>

        </div>

      </template>

    </template>



    <!-- dropdown · 紧凑下拉选择器 -->

    <template v-else-if="layout === 'dropdown'">
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="text-xs text-gray-400">{{ t('knowledge.browse.filterHint') }}</p>
        <button
          v-if="hasActiveFilter"
          type="button"
          class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300"
          @click="clearFilters"
        >
          <X class="h-3.5 w-3.5" />
          {{ t('knowledge.browse.filterClear') }}
        </button>
      </div>

      <div ref="ddRootRef" class="space-y-2">
        <!-- 体裁 -->
        <div class="kb-doc-filter-dd-row">
          <span class="kb-doc-filter-dd-label">{{ t('knowledge.browse.filterKbType') }}</span>
          <div class="kb-doc-filter-dd">
            <button
              type="button"
              class="kb-doc-filter-dd-trigger"
              :class="[openDimension === 'kbType' && 'kb-doc-filter-dd-trigger--open', kbTypeFilters.length > 0 && 'kb-doc-filter-dd-trigger--active']"
              :aria-expanded="openDimension === 'kbType'"
              @click.stop="toggleDd('kbType')"
            >
              <span class="min-w-0 flex-1 truncate text-left">{{ kbTypeTriggerLabel }}</span>
              <span v-if="kbTypeTriggerCount != null" class="kb-doc-filter-dd-count">{{ kbTypeTriggerCount }}</span>
              <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="openDimension === 'kbType' && 'rotate-180'" />
            </button>
            <div v-if="openDimension === 'kbType'" class="kb-doc-filter-dd-panel" @click.stop>
              <div v-if="kbTypePanelItems.length > DD_SEARCH_THRESHOLD" class="relative p-2">
                <Search class="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="kbTypeSearch"
                  type="search"
                  class="field-input w-full py-1.5 pl-8 text-xs"
                  :placeholder="t('knowledge.browse.filterSearch')"
                />
              </div>
              <div class="kb-doc-filter-dd-list">
                <p v-if="kbTypeLoading" class="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400">
                  <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}
                </p>
                <p v-else-if="!filteredKbTypeDdItems.length" class="px-3 py-4 text-center text-xs text-gray-400">
                  {{ t('knowledge.browse.filterSearchEmpty') }}
                </p>
                <button
                  v-for="item in filteredKbTypeDdItems"
                  v-else
                  :key="item.key"
                  type="button"
                  class="kb-doc-filter-dd-item"
                  :class="[
                    isKbTypeSelected(item) && 'kb-doc-filter-dd-item--active',
                    isKbTypeDdMuted(item) && 'kb-doc-filter-dd-item--muted',
                  ]"
                  @click="toggleKbTypeDd(item)"
                >
                  <span class="min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
                  <span class="kb-doc-filter-dd-item-count">{{ item.count }}</span>
                  <Check v-if="isKbTypeSelected(item)" class="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 分类 -->
        <div class="kb-doc-filter-dd-row">
          <span class="kb-doc-filter-dd-label">{{ t('knowledge.browse.filterCategory') }}</span>
          <div class="kb-doc-filter-dd">
            <button
              type="button"
              class="kb-doc-filter-dd-trigger"
              :class="[
                openDimension === 'category' && 'kb-doc-filter-dd-trigger--open',
                categoryEnabled && categoryFilters.length > 0 && 'kb-doc-filter-dd-trigger--active',
                !categoryEnabled && 'kb-doc-filter-dd-trigger--disabled',
              ]"
              :disabled="!categoryEnabled"
              :title="!categoryEnabled ? t('knowledge.browse.categoryNeedSingleSpace') : undefined"
              :aria-expanded="openDimension === 'category'"
              @click.stop="toggleDd('category')"
            >
              <span
                class="min-w-0 flex-1 truncate text-left"
                :class="!categoryEnabled && 'text-gray-400 dark:text-gray-500'"
              >{{ categoryEnabled ? categoryTriggerLabel : t('knowledge.browse.categoryNeedSingleSpace') }}</span>
              <span v-if="categoryEnabled && categoryTriggerCount != null" class="kb-doc-filter-dd-count">{{ categoryTriggerCount }}</span>
              <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="openDimension === 'category' && 'rotate-180'" />
            </button>
            <div v-if="categoryEnabled && openDimension === 'category'" class="kb-doc-filter-dd-panel" @click.stop>
              <div v-if="categoryPanelItems.length > DD_SEARCH_THRESHOLD" class="relative p-2">
                <Search class="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="categorySearch"
                  type="search"
                  class="field-input w-full py-1.5 pl-8 text-xs"
                  :placeholder="t('knowledge.browse.filterSearch')"
                />
              </div>
              <div class="kb-doc-filter-dd-list">
                <p v-if="categoryLoading" class="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400">
                  <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}
                </p>
                <p v-else-if="!filteredCategoryDdItems.length" class="px-3 py-4 text-center text-xs text-gray-400">
                  {{ t('knowledge.browse.filterSearchEmpty') }}
                </p>
                <button
                  v-for="item in filteredCategoryDdItems"
                  v-else
                  :key="item.key"
                  type="button"
                  class="kb-doc-filter-dd-item"
                  :class="[
                    isCategorySelected(item) && 'kb-doc-filter-dd-item--active',
                    isCategoryDdMuted(item) && 'kb-doc-filter-dd-item--muted',
                  ]"
                  @click="toggleCategoryDd(item)"
                >
                  <span class="min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
                  <span class="kb-doc-filter-dd-item-count">{{ item.count }}</span>
                  <Check v-if="isCategorySelected(item)" class="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>


    <!-- accordion · 浏览侧栏 -->

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-gray-400">{{ t('knowledge.browse.filterHint') }}</p>
        <button
          v-if="hasActiveFilter"
          type="button"
          class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300"
          @click="clearFilters"
        >
          <X class="h-3.5 w-3.5" />
          {{ t('knowledge.browse.filterClear') }}
        </button>
      </div>

      <div v-if="hasActiveFilter && !flatList" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-if="activeKbTypeLabel"
          class="kb-doc-filter-active-pill"
        >
          {{ t('knowledge.browse.filterKbType') }}: {{ activeKbTypeLabel }}
        </span>
        <span
          v-if="activeCategoryLabel"
          class="kb-doc-filter-active-pill"
        >
          {{ t('knowledge.browse.filterCategory') }}: {{ activeCategoryLabel }}
        </span>
      </div>

      <SegmentControl v-model="dimension" :options="tabOptions" class="mt-2 shrink-0" />

      <div v-if="showListSearch" class="relative mt-2 shrink-0">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          v-model="listFilter"
          type="search"
          class="field-input w-full py-1.5 pl-8 text-xs"
          :placeholder="t('knowledge.browse.filterSearch')"
        />
      </div>

      <div
        class="mt-2 space-y-0.5 overflow-y-auto pr-0.5"
        :class="flatList
          ? 'max-h-[10.5rem]'
          : fillHeight
            ? 'min-h-0 flex-1'
            : 'max-h-[min(24rem,calc(100vh-20rem))]'"
      >

        <p v-if="panelLoading" class="flex items-center gap-2 py-6 text-xs text-gray-400">

          <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}

        </p>

        <p v-else-if="!filteredPanelItems.length" class="py-6 text-center text-xs text-gray-400">
          {{ t('knowledge.browse.filterSearchEmpty') }}
        </p>

        <template v-else-if="flatList">
          <button
            v-for="item in filteredPanelItems"
            :key="item.key"
            type="button"
            class="kb-doc-filter-list-item"
            :class="isSelected(item) && 'kb-doc-filter-list-item--active'"
            @click="onFlatListClick(item)"
          >
            <span class="min-w-0 flex-1 truncate text-sm">{{ item.label }}</span>
            <span
              class="badge shrink-0 bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
              :class="isSelected(item) && 'bg-brand-100/80 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300'"
            >
              {{ item.count }}
            </span>
          </button>
        </template>

        <template v-else>

          <div v-for="item in filteredPanelItems" :key="item.key">

            <button

              type="button"

              class="flex w-full items-center gap-1 rounded-lg px-1 py-0.5 text-left transition"

              :class="isSelected(item)

                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'

                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5'"

              @click="onRowClick(item)"

            >

              <ChevronDown

                class="h-4 w-4 shrink-0 text-gray-400 transition"

                :class="!isExpanded(item.key) && '-rotate-90'"

              />

              <span class="min-w-0 flex-1 truncate py-1 text-sm font-medium">{{ item.label }}</span>

              <span

                class="badge mr-1 shrink-0 bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"

                :class="isSelected(item) && 'bg-brand-100/80 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300'"

              >

                {{ item.count }}

              </span>

            </button>

            <div

              v-if="isExpanded(item.key) && isSelected(item)"

              class="ml-3 border-l border-gray-100 pl-2 dark:border-white/10"

            >

              <slot name="expanded" :item="item" :dimension="dimension" :selected="true" />

            </div>

          </div>

        </template>

      </div>

    </template>

  </div>

</template>



<style scoped>

.kb-doc-filter-tabs :deep(.segment-control) {

  @apply w-full;

}

.kb-doc-filter-tabs :deep(.segment-item) {

  @apply flex-1 justify-center;

}



.kb-doc-filter-row {

  @apply flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3;

}

.kb-doc-filter-row-label {

  @apply shrink-0 pt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-12;

}

.kb-doc-filter-chip-list {

  @apply flex min-w-0 flex-1 flex-wrap gap-1.5;

}

.kb-doc-filter-chip {

  @apply inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition;

  @apply hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10;

}

.kb-doc-filter-chip--active {

  @apply border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300;

}

.kb-doc-filter-chip-count {

  @apply rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-gray-500 dark:bg-white/10 dark:text-gray-400;

}

.kb-doc-filter-chip--active .kb-doc-filter-chip-count {

  @apply bg-brand-100/80 text-brand-600 dark:bg-brand-500/25 dark:text-brand-300;

}

.kb-doc-filter-chip-list--scroll {
  @apply max-h-[5.5rem] overflow-y-auto pr-0.5;
}

.kb-doc-filter-list-item {
  @apply flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition;
  @apply text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5;
}

.kb-doc-filter-list-item--active {
  @apply bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300;
}

.kb-doc-filter-active-pill {
  @apply inline-flex max-w-full items-center truncate rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700;
  @apply dark:bg-brand-500/15 dark:text-brand-300;
}

.kb-doc-filter-dd-row {
  @apply flex items-center gap-2;
}

.kb-doc-filter-dd-label {
  @apply w-8 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400;
}

.kb-doc-filter-dd {
  @apply relative min-w-0 flex-1;
}

.kb-doc-filter-dd-trigger {
  @apply flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition;
  @apply hover:border-brand-200 hover:bg-brand-50/30 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5;
}

.kb-doc-filter-dd-trigger--active {
  @apply border-brand-300 bg-brand-50/60 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300;
}

.kb-doc-filter-dd-trigger--open {
  @apply border-brand-400 ring-2 ring-brand-400/20 dark:border-brand-500 dark:ring-brand-500/25;
}

.kb-doc-filter-dd-trigger--disabled {
  @apply cursor-not-allowed bg-gray-50 hover:border-gray-200 hover:bg-gray-50 dark:bg-white/[0.02] dark:hover:border-white/10 dark:hover:bg-white/[0.02];
}

.kb-doc-filter-dd-count {
  @apply shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-gray-500 dark:bg-white/10 dark:text-gray-400;
}

.kb-doc-filter-dd-trigger--active .kb-doc-filter-dd-count {
  @apply bg-brand-100/80 text-brand-600 dark:bg-brand-500/25 dark:text-brand-300;
}

.kb-doc-filter-dd-panel {
  @apply absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#1a1d27];
}

.kb-doc-filter-dd-list {
  @apply max-h-[16rem] overflow-y-auto py-1;
}

.kb-doc-filter-dd-item {
  @apply flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5;
}

.kb-doc-filter-dd-item--active {
  @apply bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300;
}

.kb-doc-filter-dd-item--muted {
  @apply text-gray-400 dark:text-gray-500;
}

.kb-doc-filter-dd-item-count {
  @apply shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-gray-500 dark:bg-white/10 dark:text-gray-400;
}

.kb-doc-filter-dd-item--active .kb-doc-filter-dd-item-count {
  @apply bg-brand-100/80 text-brand-600 dark:bg-brand-500/25 dark:text-brand-300;
}

</style>


