<script setup lang="ts">
import { computed } from 'vue'
import { useKbSpace } from '@/composables/useKbSpace'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'

const { spaces, selectedSpaceId, hasMultipleSpaces, setSelectedSpaceId } = useKbSpace()

const selectValue = computed({
  get: () => (selectedSpaceId.value == null ? 'all' : String(selectedSpaceId.value)),
  set: (v: string) => {
    setSelectedSpaceId(v === 'all' ? null : v)
  },
})

/** 与浏览页一致：至少 1 个空间即展示下拉 */
const visible = computed(() => hasMultipleSpaces.value || spaces.value.length === 1)
</script>

<template>
  <KbSpaceDropdown v-if="visible" v-model="selectValue" />
</template>
