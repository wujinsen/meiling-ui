<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKbSpace } from '@/composables/useKbSpace'

const { t } = useI18n()
const {
  spaces,
  selectedSpaceId,
  hasMultipleSpaces,
  loading,
  loadError,
  ensureSpacesLoaded,
  setSelectedSpaceId,
} = useKbSpace()

const selectValue = computed({
  get: () => (selectedSpaceId.value == null ? 'all' : String(selectedSpaceId.value)),
  set: (v: string) => {
    setSelectedSpaceId(v === 'all' ? null : v)
  },
})

onMounted(() => ensureSpacesLoaded())
</script>

<template>
  <div v-if="loading && !spaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.space.loading') }}
  </div>
  <p v-else-if="loadError" class="text-xs text-rose-500">{{ loadError }}</p>
  <p v-else-if="!spaces.length" class="text-xs text-gray-400">{{ t('knowledge.accessDenied.emptyTitle') }}</p>
  <label
    v-else-if="hasMultipleSpaces || spaces.length === 1"
    class="inline-flex min-w-[12rem] max-w-full flex-col gap-1 sm:min-w-[16rem]"
  >
    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('knowledge.space.label') }}</span>
    <div class="relative">
      <select v-model="selectValue" class="field-input w-full py-2 pr-8 text-sm">
        <option value="all">{{ t('knowledge.space.allAccessible') }}</option>
        <option v-for="s in spaces" :key="String(s.id)" :value="String(s.id)">
          {{ s.spaceName }}
          <template v-if="s.visibility === 0"> · {{ t('knowledge.space.private') }}</template>
        </option>
      </select>
    </div>
  </label>
</template>
