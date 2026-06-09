<script setup lang="ts">
defineProps<{
  active: boolean
  disabled?: boolean
  label?: string
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="active"
    :aria-label="label"
    :disabled="disabled"
    :class="[
      'status-switch',
      active ? 'status-switch--on' : 'status-switch--off',
      disabled ? 'status-switch--disabled' : '',
    ]"
    @click="$emit('click')"
  >
    <span class="status-switch__track" aria-hidden="true">
      <span class="status-switch__knob" />
    </span>
  </button>
</template>
