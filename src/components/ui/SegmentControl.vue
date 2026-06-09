<script setup lang="ts">
defineProps<{
  modelValue: number | string
  options: { value: number | string; label: string }[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number | string] }>()
</script>

<template>
  <div class="segment-control" role="radiogroup">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      role="radio"
      :aria-checked="modelValue === opt.value"
      :class="['segment-item', modelValue === opt.value && 'segment-item-active']"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
