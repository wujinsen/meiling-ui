<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Server } from 'lucide-vue-next'
import type { LinkedServerRow, OperationServer } from '@/types/operation'
import { linkedServerCount, resolvePrimaryServerLabel } from '@/utils/operationServerLinks'

const props = withDefaults(
  defineProps<{
    row: LinkedServerRow
    serverCache?: ReadonlyMap<string, OperationServer>
    clickable?: boolean
  }>(),
  { clickable: false },
)

const emit = defineEmits<{
  'view-primary': []
  'view-more': []
}>()

const { t } = useI18n()

const primaryLabel = computed(() => resolvePrimaryServerLabel(props.row, props.serverCache))
const extraCount = computed(() => linkedServerCount(props.row))
const showMore = computed(() => extraCount.value > 1)
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-if="clickable && primaryLabel"
      type="button"
      class="operation-linked-server-link"
      :title="t('operation.relations.detail')"
      @click="emit('view-primary')"
    >
      <Server class="operation-linked-server-link__icon" aria-hidden="true" />
      <span class="truncate">{{ primaryLabel }}</span>
    </button>
    <span v-else-if="primaryLabel">{{ primaryLabel }}</span>
    <span v-else class="text-gray-400">-</span>
    <button
      v-if="clickable && showMore"
      type="button"
      class="operation-alias-chip operation-alias-chip--compact operation-linked-server-more text-[10px]"
      :title="t('operation.server.pickLinkedTitle')"
      @click.stop="emit('view-more')"
    >
      +{{ extraCount - 1 }}
    </button>
    <span v-else-if="showMore" class="operation-alias-chip operation-alias-chip--compact text-[10px]">
      +{{ extraCount - 1 }}
    </span>
  </div>
</template>
