<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link2 } from 'lucide-vue-next'
import OperationLinkedServersCell from '@/components/operation/OperationLinkedServersCell.vue'
import type { LinkedServerRow, OperationServer } from '@/types/operation'
import { entityHasServer } from '@/utils/operationServerLinks'

const props = withDefaults(
  defineProps<{
    row: LinkedServerRow
    serverCache?: ReadonlyMap<string, OperationServer>
    isEdit?: boolean
    entityType?: 'project' | 'component'
    showInnerIp?: boolean
  }>(),
  { isEdit: false, entityType: 'project', showInnerIp: false },
)

const emit = defineEmits<{ 'manage-links': [] }>()

const serverIp = defineModel<string>('serverIp', { default: '' })
const innerIp = defineModel<string>('innerIp', { default: '' })

const { t } = useI18n()

const isLinked = computed(() => entityHasServer(props.row))

const hintKey = computed(() => {
  if (isLinked.value) {
    return props.entityType === 'component'
      ? 'operation.component.linkedServersFormHint'
      : 'operation.project.linkedServersFormHint'
  }
  return props.isEdit
    ? (props.entityType === 'component' ? 'operation.component.linkServersEditHint' : 'operation.project.linkServersEditHint')
    : (props.entityType === 'component' ? 'operation.component.linkServersCreateHint' : 'operation.project.linkServersCreateHint')
})
</script>

<template>
  <div class="operation-linked-servers-form">
    <template v-if="isLinked">
      <div class="flex flex-wrap items-center gap-3">
        <OperationLinkedServersCell :row="row" :server-cache="serverCache" />
        <button
          v-if="isEdit"
          type="button"
          class="btn-ghost shrink-0 px-2 py-1 text-sm"
          @click="emit('manage-links')"
        >
          <Link2 class="h-3.5 w-3.5" />
          {{ t('operation.common.linkServer') }}
        </button>
      </div>
      <p class="mt-1.5 text-xs text-gray-400">{{ t(hintKey) }}</p>
    </template>
    <template v-else>
      <input v-model="serverIp" class="field-input" :placeholder="t('operation.project.serverIp')" />
      <input
        v-if="showInnerIp"
        v-model="innerIp"
        class="field-input mt-2"
        :placeholder="t('operation.project.innerIp')"
      />
      <p class="mt-1.5 text-xs text-gray-400">{{ t(hintKey) }}</p>
    </template>
  </div>
</template>
