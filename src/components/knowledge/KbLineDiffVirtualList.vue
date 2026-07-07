<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { DiffRow } from '@/utils/lineDiff'

const props = withDefaults(
  defineProps<{
    rows: DiffRow[]
    rowHeight?: number
    overscan?: number
  }>(),
  { rowHeight: 24, overscan: 12 },
)

const scrollRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(480)

const totalHeight = computed(() => props.rows.length * props.rowHeight)

const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - props.overscan),
)

const endIndex = computed(() =>
  Math.min(
    props.rows.length,
    Math.ceil((scrollTop.value + viewportHeight.value) / props.rowHeight) + props.overscan,
  ),
)

const visibleRows = computed(() =>
  props.rows.slice(startIndex.value, endIndex.value).map((row, i) => ({
    row,
    index: startIndex.value + i,
  })),
)

const offsetY = computed(() => startIndex.value * props.rowHeight)

function onScroll() {
  scrollTop.value = scrollRef.value?.scrollTop ?? 0
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = scrollRef.value
  if (!el) return
  viewportHeight.value = el.clientHeight || viewportHeight.value
  resizeObserver = new ResizeObserver(() => {
    viewportHeight.value = scrollRef.value?.clientHeight ?? viewportHeight.value
  })
  resizeObserver.observe(el)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

function rowKey(item: { row: DiffRow; index: number }) {
  const r = item.row
  return `${item.index}:${r.type}:${r.oldNo ?? ''}:${r.newNo ?? ''}:${r.text.slice(0, 32)}`
}
</script>

<template>
  <div ref="scrollRef" class="h-full min-h-[inherit] overflow-auto" @scroll="onScroll">
    <div class="relative w-full" :style="{ height: `${totalHeight}px` }">
      <table
        class="absolute w-full table-fixed border-collapse"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <tbody>
          <tr
            v-for="item in visibleRows"
            :key="rowKey(item)"
            class="align-top"
            :style="{ height: `${rowHeight}px` }"
            :class="{
              'bg-emerald-50 dark:bg-emerald-500/10': item.row.type === 'add',
              'bg-rose-50 dark:bg-rose-500/10': item.row.type === 'del',
            }"
          >
            <td
              class="select-none border-r border-gray-100 px-2 text-right text-gray-300 dark:border-white/5"
              :style="{ height: `${rowHeight}px` }"
            >
              {{ item.row.type === 'add' ? '' : item.row.oldNo }}
            </td>
            <td
              class="select-none border-r border-gray-100 px-2 text-right text-gray-300 dark:border-white/5"
              :style="{ height: `${rowHeight}px` }"
            >
              {{ item.row.type === 'del' ? '' : item.row.newNo }}
            </td>
            <td
              class="select-none px-2"
              :style="{ height: `${rowHeight}px` }"
              :class="{
                'text-emerald-600 dark:text-emerald-400': item.row.type === 'add',
                'text-rose-500': item.row.type === 'del',
                'text-gray-300': item.row.type === 'ctx',
              }"
            >
              {{ item.row.type === 'add' ? '+' : item.row.type === 'del' ? '-' : ' ' }}
            </td>
            <td
              class="truncate px-2 text-gray-700 dark:text-gray-200"
              :style="{ height: `${rowHeight}px` }"
              :title="item.row.text"
            >
              {{ item.row.text }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
