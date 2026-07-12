<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  label: string
  disabled?: boolean
  title?: string
  showIcon?: boolean
}>()

const emit = defineEmits<{
  open: []
}>()
</script>

<template>
  <button
    type="button"
    class="operation-entity-link"
    :class="props.disabled && 'operation-entity-link--disabled'"
    :disabled="props.disabled"
    :title="props.title"
    @click.stop="emit('open')"
  >
    <span>{{ props.label }}</span>
    <ChevronRight v-if="!props.disabled && props.showIcon !== false" class="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
  </button>
</template>
