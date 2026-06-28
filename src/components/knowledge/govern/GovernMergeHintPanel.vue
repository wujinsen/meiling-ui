<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ClipboardCopy } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import type { WikiGovernMergeHintItem } from '@/types/knowledge'
import { showToast } from '@/composables/useToast'

defineProps<{
  open: boolean
  items: WikiGovernMergeHintItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

async function copyPrompt(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('success', t('knowledge.wikiGovern.mergeHintCopied'))
  } catch {
    showToast('error', t('knowledge.wikiGovern.mergeHintFailed'))
  }
}
</script>

<template>
  <AppModal
    :open="open"
    :title="t('knowledge.wikiGovern.mergeHintTitle')"
    extra-wide
    @close="emit('close')"
  >
    <div v-if="!items.length" class="py-6 text-center text-sm text-gray-400">
      {{ t('knowledge.wikiGovern.mergeHintEmpty') }}
    </div>
    <div v-else class="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <article
        v-for="(item, idx) in items"
        :key="`${item.page}-${item.kind}-${idx}`"
        class="rounded-lg border border-gray-100 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-white/5"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-mono text-sm font-medium text-gray-900 dark:text-white">{{ item.page }}</p>
            <p class="mt-0.5 text-xs text-gray-500">
              <span class="badge bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{{ item.kind }}</span>
              <span v-if="item.canonicalSlug" class="ml-2">
                {{ t('knowledge.wikiGovern.mergeHintCanonical') }}:
                <span class="font-mono">{{ item.canonicalSlug }}</span>
              </span>
            </p>
          </div>
          <button
            type="button"
            class="btn-ghost shrink-0 text-xs"
            @click="copyPrompt(item.cursorPrompt)"
          >
            <ClipboardCopy class="h-3.5 w-3.5" />
            {{ t('knowledge.wikiGovern.copyMergeHint') }}
          </button>
        </div>
        <p v-if="item.detail" class="mt-2 text-xs text-gray-600 dark:text-gray-400">{{ item.detail }}</p>
        <div v-if="item.relatedSlugs?.length" class="mt-2">
          <p class="text-xs font-medium text-gray-500">{{ t('knowledge.wikiGovern.mergeHintRelated') }}</p>
          <ul class="mt-1 flex flex-wrap gap-1">
            <li
              v-for="slug in item.relatedSlugs"
              :key="slug"
              class="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              {{ slug }}
            </li>
          </ul>
        </div>
        <ol v-if="item.manualSteps?.length" class="mt-2 list-decimal space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-400">
          <li v-for="(step, si) in item.manualSteps" :key="si">{{ step }}</li>
        </ol>
        <pre
          class="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-2 font-mono text-[11px] text-gray-700 dark:border-white/10 dark:bg-black/20 dark:text-gray-300"
        >{{ item.cursorPrompt }}</pre>
      </article>
    </div>
  </AppModal>
</template>
