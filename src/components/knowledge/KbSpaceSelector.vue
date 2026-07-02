<script setup lang="ts">
import { computed } from 'vue'
import { useKbSpace } from '@/composables/useKbSpace'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'

const props = withDefaults(
  defineProps<{
    editableOnly?: boolean
    /** Wiki Sync 等必须指定单个空间，隐藏「全部可读空间」 */
    hideAllOption?: boolean
  }>(),
  { editableOnly: false, hideAllOption: false },
)

const { spaces, selectedSpaceCode, hasMultipleSpaces, setSelectedSpaceCode } = useKbSpace()

const displaySpaces = computed(() =>
  props.editableOnly ? spaces.value.filter((s) => s.canEdit === true) : spaces.value,
)

const selectValue = computed({
  get: () => selectedSpaceCode.value ?? 'all',
  set: (v: string) => {
    setSelectedSpaceCode(v === 'all' ? null : v)
  },
})

const visible = computed(() =>
  props.editableOnly
    ? displaySpaces.value.length > 0
    : hasMultipleSpaces.value || spaces.value.length === 1,
)
</script>

<template>
  <KbSpaceDropdown
    v-if="visible"
    v-model="selectValue"
    :editable-only="editableOnly"
    :hide-all-option="hideAllOption"
  />
</template>
