<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, FoldVertical, UnfoldVertical } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useTreeExpand } from '@/composables/useTreeExpand'
import type { DeptVo } from '@/types/dept'
import { expandPathToId, findTreeNodeName, flattenVisibleTree } from '@/utils/tree'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    tree: DeptVo[]
    loading?: boolean
    allowEmpty?: boolean
  }>(),
  { allowEmpty: true },
)

const { t } = useI18n()
const open = ref(false)
const filter = ref('')
const root = ref<HTMLElement>()

const {
  expanded,
  isFullyCollapsed,
  treeExpandLabel,
  toggleExpand,
  toggleTreeExpand,
} = useTreeExpand()

useEscapeClose(open, () => {
  open.value = false
  filter.value = ''
})

const selectedLabel = computed(() => {
  if (!model.value) return t('system.user.deptNone')
  return findTreeNodeName(props.tree, model.value, 'deptName') ?? t('system.user.deptNone')
})

const flatRows = computed(() => {
  const rows = flattenVisibleTree(props.tree, expanded.value)
  const keyword = filter.value.trim().toLowerCase()
  if (!keyword) return rows
  return rows.filter((row) => row.deptName?.toLowerCase().includes(keyword))
})

function nodeClass(id: string) {
  const selected = model.value === id
  return [
    'dept-tree-select-node',
    selected && 'dept-tree-select-node-active',
  ]
}

function selectDept(id: string) {
  model.value = id
  open.value = false
  filter.value = ''
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    ensureSelectedVisible()
  } else {
    filter.value = ''
  }
}

function ensureSelectedVisible() {
  if (!model.value || !props.tree.length) return
  const path = expandPathToId(props.tree, model.value)
  if (!path.length) return
  const next = new Set(expanded.value)
  for (const id of path) next.add(id)
  expanded.value = next
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !root.value) return
  if (!root.value.contains(e.target as Node)) {
    open.value = false
    filter.value = ''
  }
}

watch(
  () => props.tree,
  (tree) => {
    if (open.value && model.value) ensureSelectedVisible()
    else if (!tree.length) expanded.value = new Set()
  },
)

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="dept-tree-select">
    <button
      type="button"
      class="dept-tree-select-trigger field-input"
      :aria-expanded="open"
      :disabled="loading"
      @click.stop="toggleOpen"
    >
      <span class="truncate text-sm" :class="!model && 'text-gray-400 dark:text-gray-500'">
        {{ loading ? t('system.user.deptTreeLoading') : selectedLabel }}
      </span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-gray-400 transition"
        :class="open && 'rotate-180'"
      />
    </button>

    <div v-if="open" class="dept-tree-select-panel" @click.stop>
      <div class="dept-tree-select-toolbar">
        <input
          v-model="filter"
          type="text"
          class="field-input min-w-0 flex-1"
          :placeholder="t('system.user.deptTreeSearch')"
        />
        <button
          type="button"
          class="btn-tree-toggle shrink-0"
          :disabled="!tree.length"
          @click="toggleTreeExpand(tree)"
        >
          <UnfoldVertical v-if="isFullyCollapsed" class="h-4 w-4 text-gray-400" />
          <FoldVertical v-else class="h-4 w-4 text-gray-400" />
          <span class="hidden sm:inline">{{ treeExpandLabel }}</span>
        </button>
      </div>

      <div class="dept-tree-select-scroll">
        <button
          v-if="allowEmpty"
          type="button"
          :class="nodeClass('')"
          @click="selectDept('')"
        >
          <span class="w-4 shrink-0" />
          <span class="truncate">{{ t('system.user.deptNone') }}</span>
        </button>

        <div v-if="loading" class="py-6 text-center text-xs text-gray-400">
          {{ t('system.user.deptTreeLoading') }}
        </div>
        <div v-else-if="!tree.length" class="py-6 text-center text-xs text-gray-400">
          {{ t('system.user.deptTreeEmpty') }}
        </div>
        <ul v-else class="space-y-0.5">
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
        <p v-if="!loading && tree.length && !flatRows.length" class="py-6 text-center text-xs text-gray-400">
          {{ t('system.common.empty') }}
        </p>
      </div>
    </div>
  </div>
</template>
