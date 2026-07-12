<script setup lang="ts">
const props = defineProps<{
  label: string
  disabled?: boolean
  title?: string
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
    {{ props.label }}
  </button>
</template>
