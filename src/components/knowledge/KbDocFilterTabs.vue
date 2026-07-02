<script setup lang="ts">

import { computed, ref, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import { ChevronDown, Loader2, X } from 'lucide-vue-next'

import SegmentControl from '@/components/ui/SegmentControl.vue'

import type { KbCategoryChip, KbCategoryFilter } from '@/composables/useKbDocFilter'

import type { KbIndexTypeFacetItem } from '@/types/knowledge'



export type KbFilterDimension = 'kbType' | 'category'



export type KbFilterAccordionItem = {

  key: string

  label: string

  count: number

  kbType: string | null

  category: KbCategoryFilter

}



const props = withDefaults(

  defineProps<{

    kbTypeChips: KbIndexTypeFacetItem[]

    kbTypeFilter: string | null

    kbTypeLoading?: boolean

    categoryChips: KbCategoryChip[]

    categoryFilter: KbCategoryFilter

    categoryLoading?: boolean

    /** accordion=浏览侧栏手风琴；chips=管理页紧凑 chip 行 */

    layout?: 'accordion' | 'chips'

    /** chips 模式下同时展示体裁+分类两行（管理页推荐） */
    showBothRows?: boolean
    /** 浏览侧栏：列表区撑满父容器剩余高度 */
    fillHeight?: boolean
  }>(),
  {
    layout: 'accordion',
    showBothRows: false,
    fillHeight: false,
  },
)



const emit = defineEmits<{

  'update:kbTypeFilter': [value: string | null]

  'update:categoryFilter': [value: KbCategoryFilter]

  activate: [item: KbFilterAccordionItem]

  clear: []

}>()



const { t } = useI18n()



const dimension = ref<KbFilterDimension>('kbType')

const expandedKeys = ref<Record<string, boolean>>({})



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

    category: props.categoryFilter,

  }

  const rows = props.kbTypeChips.map((c) => ({

    key: `kbType:${c.kbType}`,

    label: c.label,

    count: Number(c.count) || 0,

    kbType: c.kbType,

    category: props.categoryFilter,

  }))

  return [all, ...rows]

})



const categoryPanelItems = computed((): KbFilterAccordionItem[] => {

  const all: KbFilterAccordionItem = {

    key: 'category:__all__',

    label: t('knowledge.browse.filterAll'),

    count: sumCounts(props.categoryChips),

    kbType: props.kbTypeFilter,

    category: 'all',

  }

  const rows = props.categoryChips.map((c) => ({

    key: `category:${c.type}`,

    label: c.label,

    count: Number(c.count) || 0,

    kbType: props.kbTypeFilter,

    category: c.type as KbCategoryFilter,

  }))

  return [all, ...rows]

})



const panelItems = computed((): KbFilterAccordionItem[] =>

  dimension.value === 'kbType' ? kbTypePanelItems.value : categoryPanelItems.value,

)



const panelLoading = computed(() =>

  dimension.value === 'kbType' ? props.kbTypeLoading : props.categoryLoading,

)



const hasActiveFilter = computed(

  () => props.kbTypeFilter != null || props.categoryFilter !== 'all',

)



function isKbTypeSelected(item: KbFilterAccordionItem) {

  if (item.kbType == null) return props.kbTypeFilter == null

  return item.kbType === props.kbTypeFilter

}



function isCategorySelected(item: KbFilterAccordionItem) {

  if (item.category === 'all') return props.categoryFilter === 'all'

  return item.category === props.categoryFilter

}



function isSelected(item: KbFilterAccordionItem, dim: KbFilterDimension = dimension.value) {

  return dim === 'kbType' ? isKbTypeSelected(item) : isCategorySelected(item)

}



function isExpanded(key: string) {

  return expandedKeys.value[key] === true

}



function selectKbTypeItem(item: KbFilterAccordionItem) {

  emit('update:kbTypeFilter', item.kbType)

}



function selectCategoryItem(item: KbFilterAccordionItem) {

  emit('update:categoryFilter', item.category)

}



function onChipClick(item: KbFilterAccordionItem, dim: KbFilterDimension) {

  if (dim === 'kbType') selectKbTypeItem(item)

  else selectCategoryItem(item)

}



/** 点整行：选中 + 展开（仅当前项展开）；已选中且已展开时再点则折叠 */

function onRowClick(item: KbFilterAccordionItem) {

  if (isSelected(item) && isExpanded(item.key)) {

    expandedKeys.value = { ...expandedKeys.value, [item.key]: false }

    return

  }

  if (dimension.value === 'kbType') selectKbTypeItem(item)

  else selectCategoryItem(item)

  expandedKeys.value = { [item.key]: true }

  emit('activate', item)

}



function clearFilters() {

  emit('update:kbTypeFilter', null)

  emit('update:categoryFilter', 'all')

  emit('clear')

}



watch(dimension, () => {

  expandedKeys.value = {}

  const prefix = dimension.value === 'kbType' ? 'kbType:' : 'category:'

  const activeKey =

    dimension.value === 'kbType'

      ? props.kbTypeFilter

        ? `${prefix}${props.kbTypeFilter}`

        : `${prefix}__all__`

      : props.categoryFilter === 'all'

        ? `${prefix}__all__`

        : `${prefix}${props.categoryFilter}`

  expandedKeys.value = { [activeKey]: true }

})



watch(

  () => [props.kbTypeFilter, props.categoryFilter, dimension.value] as const,

  () => {

    if (props.layout !== 'accordion') return

    const prefix = dimension.value === 'kbType' ? 'kbType:' : 'category:'

    const activeKey =

      dimension.value === 'kbType'

        ? props.kbTypeFilter

          ? `${prefix}${props.kbTypeFilter}`

          : `${prefix}__all__`

        : props.categoryFilter === 'all'

          ? `${prefix}__all__`

          : `${prefix}${props.categoryFilter}`

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



      <div v-if="showBothRows" class="mt-2 space-y-3">

        <div class="kb-doc-filter-row">

          <span class="kb-doc-filter-row-label">{{ t('knowledge.browse.filterKbType') }}</span>

          <div class="kb-doc-filter-chip-list">

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

          <div class="kb-doc-filter-chip-list">

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



      <!-- chips · 单 Tab 切换（备用） -->

      <template v-else>

        <SegmentControl v-model="dimension" :options="tabOptions" />

        <div class="kb-doc-filter-chip-list mt-3">

          <p v-if="panelLoading" class="flex items-center gap-1.5 py-1 text-xs text-gray-400">

            <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}

          </p>

          <template v-else>

            <button

              v-for="item in panelItems"

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



    <!-- accordion · 浏览侧栏 -->

    <template v-else>
      <SegmentControl v-model="dimension" :options="tabOptions" class="shrink-0" />

      <div
        class="mt-3 space-y-0.5 overflow-y-auto pr-0.5"
        :class="fillHeight ? 'min-h-0 flex-1' : 'max-h-[min(24rem,calc(100vh-20rem))]'"
      >

        <p v-if="panelLoading" class="flex items-center gap-2 py-6 text-xs text-gray-400">

          <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}

        </p>

        <template v-else>

          <div v-for="item in panelItems" :key="item.key">

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

  @apply shrink-0 pt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-10;

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

</style>


