<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKbSpace } from '@/composables/useKbSpace'
import { toEntityId } from '@/utils/id'

const { t } = useI18n()
const { spaces } = useKbSpace()

const mode = defineModel<'all' | 'custom'>('mode', { default: 'all' })
const model = defineModel<string[]>({ default: () => [] })

const allIds = computed(() =>
  spaces.value.map((s) => toEntityId(s.id)).filter((id): id is string => id != null),
)

function spaceIdValue(id: number | string) {
  return toEntityId(id) ?? ''
}

function isAllSelected() {
  return allIds.value.length > 0 && model.value.length === allIds.value.length
}

function toggleAll(checked: boolean) {
  model.value = checked ? [...allIds.value] : []
}
</script>

<template>
  <div
    v-if="spaces.length > 1"
    class="rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-white/5 dark:bg-white/[0.03]"
  >
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.ask.scopeLabel') }}</span>
      <div class="inline-flex rounded-lg border border-gray-200 p-0.5 text-sm dark:border-white/10">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 transition"
          :class="mode === 'all' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          @click="mode = 'all'"
        >
          {{ t('knowledge.ask.scopeAll') }}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 transition"
          :class="mode === 'custom' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          @click="mode = 'custom'"
        >
          {{ t('knowledge.ask.scopeCustom') }}
        </button>
      </div>
      <span v-if="mode === 'all'" class="text-xs text-gray-400">{{ t('knowledge.ask.scopeAllHint') }}</span>
    </div>

    <div v-if="mode === 'custom'" class="mt-3 space-y-2">
      <label class="flex items-center gap-2 text-xs text-gray-500">
        <input
          type="checkbox"
          class="rounded border-gray-300"
          :checked="isAllSelected()"
          @change="toggleAll(($event.target as HTMLInputElement).checked)"
        />
        {{ t('knowledge.ask.selectAllSpaces') }}
      </label>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="s in spaces"
          :key="String(s.id)"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs dark:border-white/10"
          :class="model.includes(spaceIdValue(s.id)) ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300'"
        >
          <input v-model="model" type="checkbox" class="sr-only" :value="spaceIdValue(s.id)" />
          {{ s.spaceName }}
        </label>
      </div>
      <p v-if="!model.length" class="text-xs text-amber-600 dark:text-amber-400">
        {{ t('knowledge.ask.crossSpaceEmpty') }}
      </p>
    </div>
  </div>
</template>
