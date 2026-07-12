<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import { formatOperationServerLabel } from '@/utils/operationServerLinks'
import type { OperationServer } from '@/types/operation'

const props = defineProps<{
  open: boolean
  serverIds: string[]
  serverCache?: ReadonlyMap<string, OperationServer>
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

const { t } = useI18n()

const items = computed(() =>
  props.serverIds.map((id) => {
    const srv = props.serverCache?.get(id)
    return {
      id,
      label: srv ? formatOperationServerLabel(srv) : id,
      server: srv,
    }
  }),
)
</script>

<template>
  <AppModal :open="open" :title="t('operation.server.pickLinkedTitle')" @close="emit('close')">
    <p class="mb-3 text-sm text-gray-500">{{ t('operation.server.pickLinkedHint') }}</p>
    <ul class="max-h-72 space-y-2 overflow-y-auto">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left text-sm transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          @click="emit('select', item.id)"
        >
          <span class="min-w-0 font-medium text-brand-600">{{ item.label }}</span>
          <EnvironmentBadge v-if="item.server?.environment" :environment="item.server.environment" size="sm" />
        </button>
      </li>
    </ul>
    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
    </template>
  </AppModal>
</template>
