<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import type { OperationTask } from '@/types/operation'

const props = defineProps<{
  open: boolean
  task: OperationTask | null
  logText: string
  polling: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const progress = computed(() => Math.min(100, Math.max(0, props.task?.progress ?? 0)))

const statusLabel = computed(() => {
  const s = props.task?.status
  if (!s) return '-'
  const key = `operation.task.status.${s}` as const
  return t(key)
})

const statusClass = computed(() => {
  const s = props.task?.status
  if (s === 'success') return 'text-emerald-600'
  if (s === 'failed') return 'text-red-600'
  if (s === 'running') return 'text-blue-600'
  return 'text-gray-500'
})
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
        <div class="mb-1 flex justify-between text-xs text-gray-500">
          <span>{{ t('operation.task.progress') }}</span>
          <span>{{ progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-300"
            :class="{ 'animate-pulse': polling && !task?.finished }"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
      <p v-if="task?.message" class="text-sm text-gray-600 dark:text-gray-300">{{ task.message }}</p>
      <div
        class="max-h-80 overflow-y-auto rounded-lg bg-gray-900 p-3 font-mono text-xs leading-relaxed text-green-400"
      >
        <pre class="whitespace-pre-wrap break-all">{{ logText || t('operation.task.logEmpty') }}</pre>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
    </template>
  </AppModal>
</template>
