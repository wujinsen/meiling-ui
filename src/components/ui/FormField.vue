<script setup lang="ts">
defineProps<{
  label: string
  required?: boolean
  hint?: string
  horizontal?: boolean
  class?: string
}>()
</script>

<template>
  <label :class="['form-field', horizontal && 'form-field-horizontal', $props.class]">
    <span class="form-label">
      {{ label }}<span v-if="required" class="form-required">*</span>
    </span>
    <slot />
    <p v-if="hint" class="form-hint">{{ hint }}</p>
  </label>
</template>
