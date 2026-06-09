<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTreeExpand } from '@/composables/useTreeExpand'
import type { DeptVo } from '@/types/dept'
import { flattenVisibleTree } from '@/utils/tree'
import { Building2, ChevronDown, ChevronRight, FoldVertical, UnfoldVertical, Users } from 'lucide-vue-next'

const props = defineProps<{
  tree: DeptVo[]
  selectedId?: string
  loading?: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()

const { t } = useI18n()
const {
  expanded,
  isFullyCollapsed,
  treeExpandLabel,
  toggleExpand,
  toggleTreeExpand,
  expandAllIfEmpty,
} = useTreeExpand()
const filter = ref('')

const flatRows = computed(() => {
  const rows = flattenVisibleTree(props.tree, expanded.value)
  const keyword = filter.value.trim().toLowerCase()
  if (!keyword) return rows
  return rows.filter((row) => row.deptName?.toLowerCase().includes(keyword))
})

function selectDept(id: string) {
  emit('select', id)
}

function nodeClass(id: string) {
  const selected = props.selectedId === id
  return [
    'flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm transition',
    selected
      ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
  ]
}

watch(
  () => props.tree,
  (tree) => {
    if (tree.length) expandAllIfEmpty(tree)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
        <Building2 class="h-4 w-4 shrink-0 text-gray-400" />
        <span class="truncate">{{ t('system.user.deptTree') }}</span>
      </div>
      <button
        type="button"
        class="btn-tree-toggle shrink-0"
        :disabled="loading || !tree.length"
        @click="toggleTreeExpand(tree)"
      >
        <UnfoldVertical v-if="isFullyCollapsed" class="h-4 w-4 text-gray-400" />
        <FoldVertical v-else class="h-4 w-4 text-gray-400" />
        {{ treeExpandLabel }}
      </button>
    </div>

    <input
      v-model="filter"
      type="text"
      class="field-input"
      :placeholder="t('system.user.deptTreeSearch')"
    />

    <button
      type="button"
      :class="nodeClass('')"
      @click="selectDept('')"
    >
      <Users class="h-4 w-4 shrink-0 text-gray-400" />
      <span class="truncate">{{ t('system.user.deptAll') }}</span>
    </button>

    <div v-if="loading" class="py-6 text-center text-sm text-gray-400">
      {{ t('system.user.deptTreeLoading') }}
    </div>
    <div v-else-if="!tree.length" class="py-6 text-center text-sm text-gray-400">
      {{ t('system.user.deptTreeEmpty') }}
    </div>
    <ul v-else class="max-h-[calc(100vh-18rem)] space-y-0.5 overflow-y-auto pr-1">
      <li v-for="row in flatRows" :key="String(row.id)">
        <div
          role="button"
          tabindex="0"
          :class="nodeClass(String(row.id))"
          :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
          @click="selectDept(String(row.id))"
          @keydown.enter.prevent="selectDept(String(row.id))"
        >
          <button
            v-if="row.hasChildren"
            type="button"
            class="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
            @click.stop="toggleExpand(String(row.id))"
          >
            <ChevronDown v-if="expanded.has(String(row.id))" class="h-3.5 w-3.5" />
            <ChevronRight v-else class="h-3.5 w-3.5" />
          </button>
          <span v-else class="w-4 shrink-0" />
          <span class="truncate">{{ row.deptName }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
