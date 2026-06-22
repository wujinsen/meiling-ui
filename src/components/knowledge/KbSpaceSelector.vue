<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe, Lock, Users } from 'lucide-vue-next'
import { useKbSpace } from '@/composables/useKbSpace'

const { t } = useI18n()
const {
  spaces,
  selectedSpaceId,
  selectedSpace,
  hasMultipleSpaces,
  loading,
  loadError,
  ensureSpacesLoaded,
  setSelectedSpaceId,
} = useKbSpace()

const selectValue = computed({
  get: () => (selectedSpaceId.value == null ? 'all' : String(selectedSpaceId.value)),
  set: (v: string) => {
    setSelectedSpaceId(v === 'all' ? null : Number(v))
  },
})

function visibilityIcon(v?: number) {
  if (v === 0) return Lock
  if (v === 1) return Users
  return Globe
}

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
        <option v-for="s in spaces" :key="s.id" :value="String(s.id)">
          {{ s.spaceName }}
          <template v-if="s.visibility === 0"> · {{ t('knowledge.space.private') }}</template>
        </option>
      </select>
    </div>
    <p v-if="selectedSpace" class="flex items-center gap-1 text-[11px] text-gray-400">
      <component :is="visibilityIcon(selectedSpace.visibility)" class="h-3 w-3 shrink-0" />
      <span class="truncate">{{ selectedSpace.description || selectedSpace.spaceCode }}</span>
    </p>
  </label>
</template>
