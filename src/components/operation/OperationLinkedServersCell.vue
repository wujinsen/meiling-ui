<script setup lang="ts">
import { computed } from 'vue'
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

const emit = defineEmits<{ click: [] }>()

const primaryLabel = computed(() => resolvePrimaryServerLabel(props.row, props.serverCache))
const extraCount = computed(() => linkedServerCount(props.row))
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-if="clickable && primaryLabel"
      type="button"
      class="text-left text-brand-600 hover:underline"
      @click="emit('click')"
    >
      {{ primaryLabel }}
    </button>
    <span v-else-if="primaryLabel">{{ primaryLabel }}</span>
    <span v-else class="text-gray-400">-</span>
    <span v-if="extraCount > 1" class="operation-alias-chip operation-alias-chip--compact text-[10px]">
      +{{ extraCount - 1 }}
    </span>
  </div>
</template>
