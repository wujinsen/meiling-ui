<script setup lang="ts">
import { serverTagBadgeClass } from '@/utils/operationServerTag'

const props = withDefaults(
  defineProps<{
    tags?: string[] | null
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const sizeClass = props.size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
</script>

<template>
  <div v-if="props.tags?.length" class="flex flex-wrap gap-1">
    <span
      v-for="tag in props.tags"
      :key="tag"
      class="badge inline-flex shrink-0 items-center font-medium"
      :class="[serverTagBadgeClass(tag), sizeClass]"
    >
      {{ tag }}
    </span>
  </div>
  <span v-else class="text-gray-400">-</span>
</template>
