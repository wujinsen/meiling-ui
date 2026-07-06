<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-vue-next'

const { t } = useI18n()
const open = ref(false)
</script>

<template>
  <div class="rounded-xl border border-gray-100 bg-gray-50/80 dark:border-white/5 dark:bg-white/[0.02]">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200"
      @click="open = !open"
    >
      <HelpCircle class="h-4 w-4 shrink-0 text-brand-500" />
      <span class="flex-1">{{ t('knowledge.ingest.decisionHint.title') }}</span>
      <ChevronDown v-if="open" class="h-4 w-4 shrink-0 text-gray-400" />
      <ChevronRight v-else class="h-4 w-4 shrink-0 text-gray-400" />
    </button>
    <div v-if="open" class="space-y-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-600 dark:border-white/5 dark:text-gray-300">
      <div>
        <p class="font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.tabRawUpload') }}</p>
        <p class="mt-1">{{ t('knowledge.ingest.decisionHint.raw') }}</p>
      </div>
      <div>
        <p class="font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.tabIngest') }}</p>
        <p class="mt-1">{{ t('knowledge.ingest.decisionHint.ingest') }}</p>
      </div>
      <div>
        <p class="font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.tabWikiImport') }}</p>
        <p class="mt-1">{{ t('knowledge.ingest.decisionHint.wiki') }}</p>
      </div>
    </div>
  </div>
</template>
