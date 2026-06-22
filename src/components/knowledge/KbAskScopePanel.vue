<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKbSpace } from '@/composables/useKbSpace'

const { t } = useI18n()
const { spaces } = useKbSpace()

const model = defineModel<number[]>({ default: () => [] })

const enabled = defineModel<boolean>('enabled', { default: false })

const allIds = computed(() => spaces.value.map((s) => Number(s.id)))

function toggleAll(checked: boolean) {
  model.value = checked ? [...allIds.value] : []
}

function isAllSelected() {
  return allIds.value.length > 0 && model.value.length === allIds.value.length
}
</script>

<template>
  <div v-if="spaces.length > 1" class="rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-white/5 dark:bg-white/[0.03]">
    <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
      <input v-model="enabled" type="checkbox" class="rounded border-gray-300" />
      {{ t('knowledge.ask.crossSpace') }}
    </label>
    <p v-if="enabled" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ask.crossSpaceHint') }}</p>
    <div v-if="enabled" class="mt-3 space-y-2">
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
          :key="s.id"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs dark:border-white/10"
          :class="model.includes(Number(s.id)) ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300'"
        >
          <input v-model="model" type="checkbox" class="sr-only" :value="Number(s.id)" />
          {{ s.spaceName }}
        </label>
      </div>
      <p v-if="enabled && !model.length" class="text-xs text-amber-600 dark:text-amber-400">
        {{ t('knowledge.ask.crossSpaceEmpty') }}
      </p>
    </div>
  </div>
</template>
