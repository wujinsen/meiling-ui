<script setup lang="ts">
import type { PulseRange } from '@/composables/useChartDatasets'

const props = withDefaults(defineProps<{ modelValue?: PulseRange }>(), { modelValue: '30D' })
const emit = defineEmits<{ 'update:modelValue': [value: PulseRange] }>()

const ranges: PulseRange[] = ['1D', '7D', '30D', '90D']
</script>

<template>
  <div class="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-white/5">
    <button
      v-for="r in ranges"
      :key="r"
      type="button"
      :class="[
        'rounded-md px-3 py-1 text-xs font-medium transition',
        props.modelValue === r
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
      ]"
      @click="emit('update:modelValue', r)"
    >
      {{ r }}
    </button>
  </div>
</template>
