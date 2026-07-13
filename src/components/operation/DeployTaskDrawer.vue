<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReducedMotion } from '@vueuse/motion'
import { Loader2, Minimize2 } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useSmoothProgress } from '@/composables/useSmoothProgress'
import type { OperationTask } from '@/types/operation'

const props = defineProps<{
  open: boolean
  task: OperationTask | null
  logText: string
  polling: boolean
  cancelling?: boolean
}>()

const emit = defineEmits<{
  close: []
  cancel: []
  background: []
}>()

const { t } = useI18n()
const reducedMotion = useReducedMotion()

const targetProgress = computed(() => Math.min(100, Math.max(0, props.task?.progress ?? 0)))
const isRunning = computed(() => props.polling && !props.task?.finished)
const isActive = computed(() => props.open)

const { display: smoothProgress, reset: resetProgress, start: startProgress } = useSmoothProgress(
  targetProgress,
  isRunning,
  isActive,
  { speedPerSecond: 10 },
)

const progressLabel = computed(() => {
  if (reducedMotion.value) return targetProgress.value
  return Math.min(100, Math.floor(smoothProgress.value + 0.001))
})

const barWidth = computed(() => (reducedMotion.value ? targetProgress.value : smoothProgress.value))

const statusLabel = computed(() => {
  const s = props.task?.status
  if (!s) return '-'
  const key = `operation.task.status.${s}` as const
  return t(key)
})

const canCancelTask = computed(() => {
  const s = props.task?.status
  return !props.task?.finished && (s === 'pending' || s === 'running')
})

const canBackground = computed(() => canCancelTask.value && props.polling)

const statusClass = computed(() => {
  const s = props.task?.status
  if (s === 'success') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'failed') return 'text-red-600 dark:text-red-400'
  if (s === 'cancelled') return 'text-amber-600 dark:text-amber-400'
  if (s === 'running') return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-500'
})

const barStateClass = computed(() => {
  const s = props.task?.status
  if (s === 'success') return 'operation-task-progress__bar--success'
  if (s === 'failed') return 'operation-task-progress__bar--failed'
  if (s === 'cancelled') return 'operation-task-progress__bar--cancelled'
  if (isRunning.value) return 'operation-task-progress__bar--running'
  return ''
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      resetProgress()
      return
    }
    resetProgress()
    startProgress()
  },
)
</script>

<template>
  <AppModal :open="open" :title="t('operation.task.drawerTitle')" wide @close="emit('close')">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span :class="statusClass" class="font-medium">{{ statusLabel }}</span>
        <span v-if="task?.serviceKey" class="text-gray-500">{{ task.serviceKey }} · {{ task.action }}</span>
        <span v-if="task?.targetName" class="truncate text-gray-400">{{ task.targetName }}</span>
      </div>
      <div>
        <div class="mb-1.5 flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
          <span>{{ t('operation.task.progress') }}</span>
          <span class="tabular-nums">{{ progressLabel }}%</span>
        </div>
        <div class="operation-task-progress" role="progressbar" :aria-valuenow="progressLabel" aria-valuemin="0" aria-valuemax="100">
          <div
            class="operation-task-progress__bar"
            :class="barStateClass"
            :style="{ width: `${barWidth}%` }"
          />
        </div>
      </div>
      <p v-if="task?.message" class="text-sm text-gray-600 dark:text-gray-300">{{ task.message }}</p>
      <div
        class="max-h-80 overflow-y-auto rounded-lg bg-gray-900 p-3 font-mono text-xs leading-relaxed text-green-400 shadow-inner ring-1 ring-gray-800"
      >
        <pre class="whitespace-pre-wrap break-all">{{ logText || t('operation.task.logEmpty') }}</pre>
      </div>
    </div>
    <template #footer>
      <button
        v-if="canBackground"
        type="button"
        class="btn-secondary"
        @click="emit('background')"
      >
        <Minimize2 class="h-4 w-4" />
        {{ t('operation.task.runInBackground') }}
      </button>
      <button
        v-if="canCancelTask"
        type="button"
        class="btn-danger"
        :disabled="cancelling"
        @click="emit('cancel')"
      >
        <Loader2 v-if="cancelling" class="h-4 w-4 animate-spin" />
        {{ cancelling ? t('operation.task.cancelling') : t('operation.task.cancelTask') }}
      </button>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.close') }}</button>
    </template>
  </AppModal>
</template>
