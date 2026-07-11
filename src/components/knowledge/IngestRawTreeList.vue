<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import { ChevronDown, ChevronRight, Folder } from 'lucide-vue-next'
import type { KbRawCoverageItem, KbRawTreeNode } from '@/types/knowledge'

export type IngestRawFlatNode = {
  node: KbRawTreeNode
  depth: number
  hasChildren: boolean
}

const props = defineProps<{
  items: IngestRawFlatNode[]
  selected: Set<string>
  highlighted?: Set<string>
  isDirExpanded: (path: string) => boolean
  coverageForPath: (path: string) => KbRawCoverageItem | undefined
  coverageBadgeClass: (path: string) => string
  coverageBadgeLabel: (path: string) => string
  coverageTitle: (path: string) => string
}>()

const emit = defineEmits<{
  toggleFile: [path: string]
  toggleDir: [path: string]
}>()

const ROW_HEIGHT = 28
const BUFFER = 12

const scrollRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(288)

const visibleSlice = computed(() => {
  const total = props.items.length
  if (!total) return { items: [] as { item: IngestRawFlatNode; index: number }[] }
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER)
  const count = Math.ceil(viewportHeight.value / ROW_HEIGHT) + BUFFER * 2
  const end = Math.min(total, start + count)
  const items: { item: IngestRawFlatNode; index: number }[] = []
  for (let i = start; i < end; i++) {
    items.push({ item: props.items[i]!, index: i })
  }
  return { items }
})

const totalHeight = computed(() => props.items.length * ROW_HEIGHT)

function onScroll() {
  if (!scrollRef.value) return
  scrollTop.value = scrollRef.value.scrollTop
}

function updateViewportHeight() {
  if (scrollRef.value) viewportHeight.value = scrollRef.value.clientHeight || 288
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateViewportHeight()
  if (scrollRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateViewportHeight)
    resizeObserver.observe(scrollRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.items.length,
  () => {
    if (scrollRef.value && scrollTop.value > totalHeight.value) {
      scrollRef.value.scrollTop = 0
      scrollTop.value = 0
    }
  },
)
</script>

<template>
  <div ref="scrollRef" class="kb-ingest-raw-tree-scroll h-full overflow-auto p-2" @scroll="onScroll">
    <div class="relative w-full" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="{ item, index } in visibleSlice.items"
        :key="item.node.path"
        class="absolute left-0 right-0 flex items-center gap-1.5 rounded px-1.5 text-xs hover:bg-gray-50 dark:hover:bg-white/5"
        :class="[
          item.node.type === 'file' ? 'no-tilt-drag cursor-pointer' : item.hasChildren ? 'no-tilt-drag cursor-pointer' : '',
          item.node.type === 'file' && highlighted?.has(item.node.path)
            ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
            : '',
        ]"
        :style="{
          top: `${index * ROW_HEIGHT}px`,
          height: `${ROW_HEIGHT}px`,
          paddingLeft: `${item.depth * 14 + 6}px`,
        }"
        @click="item.node.type === 'file' ? emit('toggleFile', item.node.path) : item.hasChildren && emit('toggleDir', item.node.path)"
      >
        <template v-if="item.node.type === 'dir'">
          <ChevronDown
            v-if="item.hasChildren && isDirExpanded(item.node.path)"
            class="h-3.5 w-3.5 shrink-0 text-gray-400"
          />
          <ChevronRight v-else-if="item.hasChildren" class="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span v-else class="inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <Folder class="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span class="truncate text-gray-500 dark:text-gray-400">{{ item.node.name }}</span>
        </template>
        <template v-else>
          <span class="inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <AppCheckbox
            standalone
            size="sm"
            class="pointer-events-none shrink-0"
            :model-value="selected.has(item.node.path)"
          />
          <span
            v-if="coverageForPath(item.node.path)"
            class="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
            :class="coverageBadgeClass(item.node.path)"
            :title="coverageTitle(item.node.path)"
          >
            {{ coverageBadgeLabel(item.node.path) }}
          </span>
          <span class="min-w-0 truncate text-gray-700 dark:text-gray-200">{{ item.node.name }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
