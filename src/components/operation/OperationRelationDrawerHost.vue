<script setup lang="ts">
import RelationDrawer, { type RelationDrawerTab } from '@/components/operation/RelationDrawer.vue'
import type { OperationRelationEntityType } from '@/types/operation'

defineProps<{
  open: boolean
  entityType: OperationRelationEntityType
  entityId: number | string | null
  entityName?: string
  initialTab?: RelationDrawerTab
  showEditLinks?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <RelationDrawer
    :open="open"
    :entity-type="entityType"
    :entity-id="entityId"
    :entity-name="entityName"
    :initial-tab="initialTab"
    :show-edit-links="showEditLinks ?? false"
    @close="emit('close')"
    @edit-links="emit('close')"
  />
</template>
