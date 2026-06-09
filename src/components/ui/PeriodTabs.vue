<script setup lang="ts">
defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function select(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="inline-flex rounded-lg bg-gray-100 p-1 text-xs dark:bg-white/5">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="[
        'rounded-md px-3 py-1 font-medium transition',
        modelValue === opt.value
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
      ]"
      @click="select(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
