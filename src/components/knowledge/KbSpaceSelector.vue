<script setup lang="ts">
import { computed } from 'vue'
import { useKbSpace } from '@/composables/useKbSpace'
import KbSpaceScopePicker from '@/components/knowledge/KbSpaceScopePicker.vue'

const props = withDefaults(
  defineProps<{
    editableOnly?: boolean
    /** Wiki Sync 等必须指定单个空间，隐藏「全部可读空间」 */
    hideAllOption?: boolean
  }>(),
  { editableOnly: false, hideAllOption: false },
)

const { spaces, hasMultipleSpaces } = useKbSpace()

const displaySpaces = computed(() =>
  props.editableOnly ? spaces.value.filter((s) => s.canEdit === true) : spaces.value,
)

const visible = computed(() =>
  props.editableOnly
    ? displaySpaces.value.length > 0
    : hasMultipleSpaces.value || spaces.value.length === 1,
)
</script>

<template>
  <KbSpaceScopePicker
    v-if="visible"
    single-select
    :writable-only="editableOnly"
    :hide-all-option="hideAllOption"
  />
</template>
