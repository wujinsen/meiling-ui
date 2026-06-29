<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, FolderTree, Loader2 } from 'lucide-vue-next'
import type { KbCategoryTree } from '@/types/knowledge'
import { useTreeExpand } from '@/composables/useTreeExpand'
import { flattenVisibleTree } from '@/utils/tree'
import { toEntityId } from '@/utils/id'

export type KbDocCategoryFilter = 'all' | 'uncategorized' | string

const props = defineProps<{
  categories: KbCategoryTree[]
  loading?: boolean
  selected: KbDocCategoryFilter
  uncategorizedCount?: number
}>()

const emit = defineEmits<{
  select: [value: KbDocCategoryFilter]
}>()

const { t } = useI18n()
const { expanded, toggleExpand, expandAllIfEmpty } = useTreeExpand()

const flatRows = computed(() => flattenVisibleTree(props.categories, expanded.value))

function rowId(row: KbCategoryTree) {
  return toEntityId(row.id) ?? ''
}

function isSelected(id: KbDocCategoryFilter) {
  return props.selected === id
}

function select(id: KbDocCategoryFilter) {
  emit('select', id)
}

watch(
  () => props.categories,
  (tree) => {
    if (tree.length) expandAllIfEmpty(tree)
  },
  { immediate: true },
)
</script>

<template>
  <nav class="flex flex-col gap-0.5" :aria-label="t('knowledge.docManage.categoryTree')">
    <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      <FolderTree class="h-3.5 w-3.5" /> {{ t('knowledge.docManage.categoryTree') }}
    </p>

    <p v-if="loading" class="flex items-center gap-2 py-6 text-xs text-gray-400">
      <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('common.loading') }}
    </p>

    <template v-else>
      <button
        type="button"
        class="kb-doc-cat-tree-item"
        :class="isSelected('all') && 'kb-doc-cat-tree-item--active'"
        @click="select('all')"
      >
        <span class="truncate">{{ t('knowledge.docManage.categoryAll') }}</span>
      </button>

      <template v-for="row in flatRows" :key="String(row.id)">
        <button
          type="button"
          class="kb-doc-cat-tree-item"
          :class="isSelected(rowId(row)) && 'kb-doc-cat-tree-item--active'"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          @click="select(rowId(row))"
        >
          <span
            v-if="row.hasChildren"
            class="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
            @click.stop="toggleExpand(String(row.id))"
          >
            <ChevronDown v-if="expanded.has(String(row.id))" class="h-3.5 w-3.5" />
            <ChevronRight v-else class="h-3.5 w-3.5" />
          </span>
          <span v-else class="inline-block w-[22px] shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-left">{{ row.categoryName }}</span>
          <span v-if="row.docCount != null" class="badge shrink-0 bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
            {{ row.docCount }}
          </span>
        </button>
      </template>

      <button
        type="button"
        class="kb-doc-cat-tree-item mt-1 border-t border-gray-100 pt-2 dark:border-white/5"
        :class="isSelected('uncategorized') && 'kb-doc-cat-tree-item--active'"
        @click="select('uncategorized')"
      >
        <span class="inline-block w-[22px] shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-left">{{ t('knowledge.docManage.uncategorized') }}</span>
        <span
          v-if="uncategorizedCount != null"
          class="badge shrink-0 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        >
          {{ uncategorizedCount }}
        </span>
      </button>
    </template>
  </nav>
</template>

<style scoped>
.kb-doc-cat-tree-item {
  @apply flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-gray-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5;
}
.kb-doc-cat-tree-item--active {
  @apply bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300;
}
</style>
