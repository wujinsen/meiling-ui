<script setup lang="ts">
import { computed } from 'vue'
import { useKbSpace } from '@/composables/useKbSpace'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'

const props = withDefaults(
  defineProps<{
    editableOnly?: boolean
  }>(),
  { editableOnly: false },
)

const { spaces, selectedSpaceId, hasMultipleSpaces, setSelectedSpaceId } = useKbSpace()

const displaySpaces = computed(() =>
  props.editableOnly ? spaces.value.filter((s) => s.canEdit === true) : spaces.value,
)

const selectValue = computed({
  get: () => (selectedSpaceId.value == null ? 'all' : String(selectedSpaceId.value)),
  set: (v: string) => {
    setSelectedSpaceId(v === 'all' ? null : v)
  },
})

const visible = computed(() =>
  props.editableOnly
    ? displaySpaces.value.length > 0
    : hasMultipleSpaces.value || spaces.value.length === 1,
)
</script>

<template>
  <KbSpaceDropdown v-if="visible" v-model="selectValue" :editable-only="editableOnly" />
</template>
