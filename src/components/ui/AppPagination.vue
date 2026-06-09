<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  pageNum: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  'update:pageNum': [number]
}>()

const { t } = useI18n()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

function go(page: number) {
  const next = Math.min(Math.max(1, page), totalPages.value)
  if (next !== props.pageNum) emit('update:pageNum', next)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
    <span>{{ t('common.paginationTotal', { total }) }}</span>
    <div class="flex items-center gap-2">
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
