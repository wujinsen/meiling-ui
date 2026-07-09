<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Loader2, RefreshCw } from 'lucide-vue-next'
import type { KbWikiSpaceLintResult } from '@/types/knowledge'
import { countLintErrors } from '@/utils/kbWikiGovern'
import { kbLintRoute } from '@/utils/kbWorkflowRoutes'

const props = defineProps<{
  baseline: KbWikiSpaceLintResult | null
  current: KbWikiSpaceLintResult | null
  relinting: boolean
  canEdit: boolean
  spaceId?: string | number | null
}>()

const emit = defineEmits<{
  relint: []
}>()

const { t } = useI18n()
const router = useRouter()

const baselineErrors = computed(() => countLintErrors(props.baseline))
const currentErrors = computed(() => countLintErrors(props.current))
const baselineIssues = computed(() => props.baseline?.stats?.issues ?? props.baseline?.issues.length ?? 0)
const currentIssues = computed(() => props.current?.stats?.issues ?? props.current?.issues.length ?? 0)

const hasRelint = computed(() => props.current != null && props.baseline != null && props.current !== props.baseline)

const improved = computed(() => {
  if (!hasRelint.value) return false
  return currentIssues.value < baselineIssues.value
})

function openHealthScan() {
  void router.push(kbLintRoute({ spaceId: props.spaceId }))
}

function openHealthSync() {
  void router.push(kbLintRoute({ tab: 'sync', spaceId: props.spaceId }))
}
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-gray-900/40">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('knowledge.wikiGovern.relintTitle') }}
        </h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.relintHint') }}
        </p>
      </div>
      <button
        type="button"
        class="btn-ghost shrink-0 text-sm"
        :disabled="!canEdit || relinting || !baseline"
        @click="emit('relint')"
      >
        <Loader2 v-if="relinting" class="h-4 w-4 animate-spin" />
        <RefreshCw v-else class="h-4 w-4" />
        {{ t('knowledge.wikiGovern.relint') }}
      </button>
    </div>

    <div v-if="hasRelint" class="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span class="text-gray-500">{{ t('knowledge.wikiGovern.relintIssues') }}</span>
      <span class="font-medium text-gray-800 dark:text-gray-100">{{ baselineIssues }}</span>
      <ArrowRight class="h-4 w-4 text-gray-400" />
      <span
        class="font-medium"
        :class="improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-800 dark:text-gray-100'"
      >
        {{ currentIssues }}
      </span>
      <span class="text-xs text-gray-400">
        ({{ t('knowledge.wikiGovern.relintErrors', { before: baselineErrors, after: currentErrors }) }})
      </span>
      <span
        v-if="currentIssues === 0"
        class="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      >
        {{ t('knowledge.wikiGovern.relintClean') }}
      </span>
      <div v-if="hasRelint && improved" class="mt-2 flex flex-wrap gap-2">
        <button type="button" class="btn-ghost text-xs" @click="openHealthScan">
          {{ t('knowledge.wikiGovern.openHealthScan') }}
          <ArrowRight class="ml-1 inline h-3 w-3" />
        </button>
        <button type="button" class="btn-ghost text-xs" @click="openHealthSync">
          {{ t('knowledge.wikiGovern.openHealthSync') }}
          <ArrowRight class="ml-1 inline h-3 w-3" />
        </button>
      </div>
    </div>
  </section>
</template>
