<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import DeployBatchTaskRow from '@/components/operation/DeployBatchTaskRow.vue'
import type { BatchTaskItem } from '@/composables/useDeployBatchTasks'

const props = defineProps<{
  open: boolean
  title: string
  items: BatchTaskItem[]
}>()

const emit = defineEmits<{
  close: []
  retry: [serverId: string]
}>()

const { t } = useI18n()

const summary = computed(() => {
  let success = 0
  let failed = 0
  let running = 0
  for (const item of props.items) {
    if (item.status === 'success') success += 1
    else if (item.status === 'failed' || item.status === 'createFailed') failed += 1
    else running += 1
  }
  return t('operation.task.batch.summary', { success, failed, running })
})
</script>

<template>
  <AppModal :open="open" :title="t('operation.task.batch.title', { title, count: items.length })" wide @close="emit('close')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ summary }}</p>
      <DeployBatchTaskRow
        v-for="item in items"
        :key="item.serverId"
        :item="item"
        @retry="emit('retry', $event)"
      />
    </div>
    <template #footer>
      <button type="button" class="operation-toolbar-action" @click="emit('close')">{{ t('operation.common.close') }}</button>
    </template>
  </AppModal>
</template>
