<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RelationFilterKey } from '@/composables/useOperationRelationListFilter'

defineProps<{
  filters: Array<{
    key: RelationFilterKey
    label: string
  }>
}>()

const emit = defineEmits<{
  clear: [key: RelationFilterKey]
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="filters.length" class="mb-4 flex flex-wrap items-center gap-2">
    <span
      v-for="filter in filters"
      :key="filter.key"
      class="operation-relation-filter-chip"
    >
      <span>{{ t('operation.relations.filterChip', { label: filter.label }) }}</span>
      <button
        type="button"
        class="operation-relation-filter-chip__clear"
        :aria-label="t('operation.common.clear')"
        @click="emit('clear', filter.key)"
      >
        ×
      </button>
    </span>
  </div>
</template>
