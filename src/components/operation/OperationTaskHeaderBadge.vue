<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useOperationTaskHub } from '@/composables/operationTaskHub'

const { t } = useI18n()
const { runningBackgroundCount, openFloater } = useOperationTaskHub()
</script>

<template>
  <button
    v-if="runningBackgroundCount > 0"
    type="button"
    class="operation-task-header-badge"
    :title="t('operation.task.backgroundRunningCount', { count: runningBackgroundCount })"
    @click="openFloater"
  >
    <Loader2 class="h-4 w-4 animate-spin" />
    <span class="operation-task-header-badge__count">{{ runningBackgroundCount }}</span>
  </button>
</template>
