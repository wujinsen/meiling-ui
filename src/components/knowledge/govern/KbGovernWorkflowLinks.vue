<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Cpu, HeartPulse, Upload } from 'lucide-vue-next'
import {
  kbIngestRoute,
  kbLintRoute,
  kbLlmSettingsRoute,
} from '@/utils/kbWorkflowRoutes'

const { spaceId } = defineProps<{
  spaceId?: string | number | null
}>()

const { t } = useI18n()
const router = useRouter()

type WorkflowRoute = { path: string; query?: Record<string, string> }

function go(target: WorkflowRoute) {
  void router.push(target)
}
</script>

<template>
  <section class="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
    <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">
      {{ t('knowledge.wikiGovern.workflowLinksTitle') }}
    </p>
    <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
      {{ t('knowledge.wikiGovern.workflowLinksHint') }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        class="btn-ghost inline-flex items-center gap-1.5 border border-gray-200 bg-white text-xs dark:border-white/10 dark:bg-gray-900/40"
        @click="go(kbIngestRoute(spaceId))"
      >
        <Upload class="h-3.5 w-3.5" />
        {{ t('knowledge.wikiGovern.openIngest') }}
        <ArrowRight class="h-3 w-3 opacity-60" />
      </button>
      <button
        type="button"
        class="btn-ghost inline-flex items-center gap-1.5 border border-gray-200 bg-white text-xs dark:border-white/10 dark:bg-gray-900/40"
        @click="go(kbLintRoute({ spaceId }))"
      >
        <HeartPulse class="h-3.5 w-3.5" />
        {{ t('knowledge.wikiGovern.openHealthLint') }}
        <ArrowRight class="h-3 w-3 opacity-60" />
      </button>
      <button
        type="button"
        class="btn-ghost inline-flex items-center gap-1.5 border border-gray-200 bg-white text-xs dark:border-white/10 dark:bg-gray-900/40"
        @click="go(kbLintRoute({ tab: 'sync', spaceId }))"
      >
        <HeartPulse class="h-3.5 w-3.5" />
        {{ t('knowledge.wikiGovern.openHealthSync') }}
        <ArrowRight class="h-3 w-3 opacity-60" />
      </button>
      <button
        type="button"
        class="btn-ghost inline-flex items-center gap-1.5 border border-gray-200 bg-white text-xs dark:border-white/10 dark:bg-gray-900/40"
        @click="go(kbLlmSettingsRoute())"
      >
        <Cpu class="h-3.5 w-3.5" />
        {{ t('knowledge.wikiGovern.openLlmSettings') }}
        <ArrowRight class="h-3 w-3 opacity-60" />
      </button>
    </div>
  </section>
</template>
