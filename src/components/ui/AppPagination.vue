<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'

const props = withDefaults(
  defineProps<{
    pageNum: number
    pageSize: number
    total: number
    pageSizeOptions?: readonly number[]
    showPageSize?: boolean
  }>(),
  {
    pageSizeOptions: () => PAGE_SIZE_OPTIONS,
    showPageSize: true,
  },
)

const emit = defineEmits<{
  'update:pageNum': [number]
  'update:pageSize': [number]
}>()

const { t } = useI18n()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

function go(page: number) {
  const next = Math.min(Math.max(1, page), totalPages.value)
  if (next !== props.pageNum) emit('update:pageNum', next)
}

function onPageSizeChange(event: Event) {
  const next = Number((event.target as HTMLSelectElement).value)
  if (!Number.isFinite(next) || next === props.pageSize) return
  emit('update:pageSize', next)
  if (props.pageNum !== 1) emit('update:pageNum', 1)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
    <span>{{ t('common.paginationTotal', { total }) }}</span>
    <div class="flex flex-wrap items-center gap-2">
      <label v-if="showPageSize" class="inline-flex items-center gap-1.5">
        <span class="text-xs">{{ t('common.pageSize') }}</span>
        <select
          class="field-input min-w-[4.5rem] py-1 text-xs tabular-nums"
          :value="pageSize"
          @change="onPageSizeChange"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <button type="button" class="btn-ghost px-2 py-1" :disabled="pageNum <= 1" @click="go(pageNum - 1)">
        <ChevronLeft class="h-4 w-4" />
      </button>
      <span class="tabular-nums">{{ pageNum }} / {{ totalPages }}</span>
      <button type="button" class="btn-ghost px-2 py-1" :disabled="pageNum >= totalPages" @click="go(pageNum + 1)">
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
