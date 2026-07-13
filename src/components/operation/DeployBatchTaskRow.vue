<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Loader2, RotateCcw } from 'lucide-vue-next'
import { useSmoothProgress } from '@/composables/useSmoothProgress'
import type { BatchTaskItem } from '@/composables/useDeployBatchTasks'

const props = defineProps<{
  item: BatchTaskItem
}>()

const emit = defineEmits<{
  retry: [serverId: string]
}>()

const { t } = useI18n()

const logOpen = ref(false)

const targetProgress = computed(() => Math.min(100, Math.max(0, props.item.task?.progress ?? 0)))
const isRunning = computed(() => props.item.status === 'creating' || props.item.status === 'running')
const isActive = computed(() => props.item.status !== 'createFailed')

const { display: smoothProgress } = useSmoothProgress(targetProgress, isRunning, isActive, {
  speedPerSecond: 10,
})

const barWidth = computed(() => {
  if (props.item.status === 'success') return 100
  if (props.item.status === 'createFailed') return 0
  return smoothProgress.value
})

const progressLabel = computed(() => Math.min(100, Math.floor(barWidth.value + 0.001)))

const statusLabel = computed(() => {
  switch (props.item.status) {
    case 'creating':
      return t('operation.task.batch.creating')
    case 'createFailed':
      return t('operation.task.batch.createFailed')
    case 'success':
      return t('operation.task.status.success')
    case 'failed':
      return t('operation.task.status.failed')
    default:
      return t('operation.task.status.running')
  }
})

const statusClass = computed(() => {
  switch (props.item.status) {
    case 'success':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'failed':
    case 'createFailed':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-blue-600 dark:text-blue-400'
  }
})

const barStateClass = computed(() => {
  switch (props.item.status) {
    case 'success':
      return 'operation-task-progress__bar--success'
    case 'failed':
      return 'operation-task-progress__bar--failed'
    case 'createFailed':
      return ''
    default:
      return 'operation-task-progress__bar--running'
  }
})
</script>

<template>
  <div class="rounded-lg border border-gray-100 p-3 dark:border-white/10">
    <div class="flex flex-wrap items-center gap-3">
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ item.serverName }}</span>
      <span class="text-xs font-medium" :class="statusClass">
        <Loader2 v-if="isRunning" class="mr-1 inline h-3 w-3 animate-spin" />
        {{ statusLabel }}
      </span>
      <span class="text-xs tabular-nums text-gray-500">{{ progressLabel }}%</span>
      <button
        v-if="item.status === 'createFailed'"
        type="button"
        class="btn-secondary text-xs"
        @click="emit('retry', item.serverId)"
      >
        <RotateCcw class="h-3 w-3" /> {{ t('operation.task.batch.retry') }}
      </button>
      <button
        v-else
        type="button"
        class="operation-toolbar-action"
        :aria-pressed="logOpen"
        @click="logOpen = !logOpen"
      >
        {{ t('operation.task.batch.viewLog') }}
        <ChevronDown class="h-3.5 w-3.5 transition-transform" :class="logOpen && 'rotate-180'" />
      </button>
    </div>

    <div
      class="operation-task-progress mt-2"
      role="progressbar"
      :aria-valuenow="progressLabel"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="operation-task-progress__bar" :class="barStateClass" :style="{ width: `${barWidth}%` }" />
    </div>

    <p v-if="item.status === 'createFailed' && item.error" class="mt-2 text-xs text-red-600 dark:text-red-400">
      {{ item.error }}
    </p>
    <p v-else-if="item.task?.message" class="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
      {{ item.task.message }}
    </p>

    <div
      v-if="logOpen"
      class="mt-3 max-h-56 overflow-y-auto rounded-lg bg-gray-900 p-3 font-mono text-xs leading-relaxed text-green-400 shadow-inner ring-1 ring-gray-800"
    >
      <pre class="whitespace-pre-wrap break-all">{{ item.logText || t('operation.task.logEmpty') }}</pre>
    </div>
  </div>
</template>
