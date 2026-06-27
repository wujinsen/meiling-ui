<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Sparkles, Square, Wand2, XCircle } from 'lucide-vue-next'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import type { KbWikiLintIssue } from '@/types/knowledge'
import {
  buildEnrichTargets,
  buildReviseTargets,
  defaultEnrichBatchNo,
  isWikiGovernAiReviseable,
  isWikiGovernEnrichable,
  isWikiGovernManualOnly,
  wikiGovernIssueKey,
} from '@/utils/kbWikiGovern'

export type GovernFixMode = 'enrich' | 'ai-revise'

export type GovernFixProgress = {
  mode: GovernFixMode
  total: number
  done: number
  ok: number
  failed: number
  skipped: number
  currentSlug?: string
  errors: Array<{ slug: string; message: string }>
}

const props = defineProps<{
  issues: KbWikiLintIssue[]
  selectedKeys: Set<string>
  fixing: boolean
  progress: GovernFixProgress | null
  canEdit: boolean
}>()

const emit = defineEmits<{
  start: [payload: { mode: GovernFixMode; batchNo: string; topic: string; appendGovernance: boolean }]
  cancel: []
}>()

const { t } = useI18n()

const fixMode = ref<GovernFixMode>('ai-revise')
const batchNo = ref(defaultEnrichBatchNo())
const topic = ref('')
const appendGovernance = ref(true)

const selectedIssues = computed(() =>
  props.issues.filter((issue) => props.selectedKeys.has(wikiGovernIssueKey(issue))),
)

const enrichableIssues = computed(() => selectedIssues.value.filter(isWikiGovernEnrichable))
const reviseIssues = computed(() => selectedIssues.value.filter(isWikiGovernAiReviseable))
const manualIssues = computed(() => selectedIssues.value.filter(isWikiGovernManualOnly))
const otherIssues = computed(() =>
  selectedIssues.value.filter(
    (i) => !isWikiGovernEnrichable(i) && !isWikiGovernAiReviseable(i) && !isWikiGovernManualOnly(i),
  ),
)

const enrichTargets = computed(() => buildEnrichTargets(enrichableIssues.value))
const reviseTargets = computed(() => buildReviseTargets(reviseIssues.value))

const activeTargets = computed(() =>
  fixMode.value === 'enrich' ? enrichTargets.value : reviseTargets.value,
)

const fixModeOptions = computed(() => [
  { value: 'ai-revise' as const, label: t('knowledge.wikiGovern.fixModeRevise') },
  { value: 'enrich' as const, label: t('knowledge.wikiGovern.fixModeEnrich') },
])

const canStart = computed(
  () => props.canEdit && !props.fixing && activeTargets.value.length > 0,
)

const progressPct = computed(() => {
  if (!props.progress?.total) return 0
  return Math.round((props.progress.done / props.progress.total) * 100)
})

watch(selectedIssues, (list) => {
  if (!list.length) return
  const reviseCount = list.filter(isWikiGovernAiReviseable).length
  const enrichCount = list.filter(isWikiGovernEnrichable).length
  if (reviseCount >= enrichCount) fixMode.value = 'ai-revise'
  else fixMode.value = 'enrich'
})

function startFix() {
  if (!canStart.value) return
  emit('start', {
    mode: fixMode.value,
    batchNo: batchNo.value.trim() || defaultEnrichBatchNo(),
    topic: topic.value.trim() || t('knowledge.wikiGovern.defaultTopic'),
    appendGovernance: appendGovernance.value,
  })
}
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/40">
    <header class="border-b border-gray-100 px-4 py-3 dark:border-white/5">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('knowledge.wikiGovern.fixPanelTitle') }}
      </h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ t('knowledge.wikiGovern.fixPanelHint') }}
      </p>
    </header>

    <div class="space-y-4 px-4 py-4">
      <p v-if="!canEdit" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        {{ t('knowledge.wikiGovern.readOnlyHint') }}
      </p>

      <div v-if="!selectedIssues.length" class="py-6 text-center text-sm text-gray-400">
        {{ t('knowledge.wikiGovern.fixNoSelection') }}
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-3">
          <SegmentControl v-model="fixMode" :options="fixModeOptions" />
        </div>

        <div class="flex flex-wrap gap-2 text-xs">
          <span
            v-if="fixMode === 'ai-revise'"
            class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          >
            {{ t('knowledge.wikiGovern.fixReviseable', { count: reviseTargets.length }) }}
          </span>
          <span
            v-else
            class="badge bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          >
            {{ t('knowledge.wikiGovern.fixEnrichable', { count: enrichTargets.length }) }}
          </span>
          <span v-if="manualIssues.length" class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {{ t('knowledge.wikiGovern.fixManual', { count: manualIssues.length }) }}
          </span>
          <span v-if="otherIssues.length" class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
            {{ t('knowledge.wikiGovern.fixOther', { count: otherIssues.length }) }}
          </span>
        </div>

        <div v-if="manualIssues.length" class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.fixManualHint') }}
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-xs">
            <span class="mb-1 block text-gray-500">{{ t('knowledge.wikiGovern.batchNo') }}</span>
            <input v-model="batchNo" type="text" class="input w-full text-sm" :disabled="fixing" />
          </label>
          <label class="block text-xs">
            <span class="mb-1 block text-gray-500">{{ t('knowledge.wikiGovern.topic') }}</span>
            <input
              v-model="topic"
              type="text"
              class="input w-full text-sm"
              :placeholder="t('knowledge.wikiGovern.topicPlaceholder')"
              :disabled="fixing"
            />
          </label>
        </div>

        <label
          v-if="fixMode === 'enrich'"
          class="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
        >
          <input v-model="appendGovernance" type="checkbox" class="h-4 w-4 rounded" :disabled="fixing" />
          {{ t('knowledge.wikiGovern.appendGovernance') }}
        </label>

        <ul v-if="activeTargets.length" class="max-h-40 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/5">
          <li
            v-for="target in activeTargets"
            :key="target.slug"
            class="border-b border-gray-50 px-3 py-2 text-xs last:border-0 dark:border-white/5"
          >
            <span class="font-mono text-indigo-700 dark:text-indigo-300">{{ target.slug }}</span>
            <span class="ml-2 text-gray-400">×{{ target.issues.length }}</span>
          </li>
        </ul>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-primary text-sm" :disabled="!canStart" @click="startFix">
            <Wand2 v-if="fixMode === 'ai-revise'" class="h-4 w-4" />
            <Sparkles v-else class="h-4 w-4" />
            {{
              fixing
                ? t('knowledge.wikiGovern.fixRunning')
                : fixMode === 'ai-revise'
                  ? t('knowledge.wikiGovern.startRevise')
                  : t('knowledge.wikiGovern.startEnrich')
            }}
          </button>
          <button v-if="fixing" type="button" class="btn-ghost text-sm" @click="emit('cancel')">
            <Square class="h-4 w-4" /> {{ t('knowledge.wikiGovern.cancelFix') }}
          </button>
        </div>

        <div v-if="progress" class="space-y-2 rounded-lg bg-gray-50 px-3 py-3 dark:bg-white/5">
          <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              <Loader2 v-if="fixing" class="mr-1 inline h-3.5 w-3.5 animate-spin" />
              {{
                progress.mode === 'ai-revise'
                  ? t('knowledge.wikiGovern.reviseProgress', { done: progress.done, total: progress.total })
                  : t('knowledge.wikiGovern.fixProgress', { done: progress.done, total: progress.total })
              }}
            </span>
            <span>{{ progressPct }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div
              class="h-full rounded-full bg-indigo-500 transition-all duration-300"
              :style="{ width: `${progressPct}%` }"
            />
          </div>
          <p v-if="progress.currentSlug" class="truncate font-mono text-[11px] text-gray-500">
            {{ progress.currentSlug }}
          </p>
          <div class="flex flex-wrap gap-3 text-xs">
            <span class="text-emerald-600 dark:text-emerald-400">✓ {{ progress.ok }}</span>
            <span class="text-rose-600 dark:text-rose-400">✗ {{ progress.failed }}</span>
            <span class="text-gray-400">{{ t('knowledge.wikiGovern.skipped', { count: progress.skipped }) }}</span>
          </div>
          <ul v-if="progress.errors.length" class="max-h-24 space-y-1 overflow-y-auto text-xs text-rose-600 dark:text-rose-400">
            <li v-for="(err, idx) in progress.errors" :key="idx" class="flex gap-1">
              <XCircle class="mt-0.5 h-3 w-3 shrink-0" />
              <span><span class="font-mono">{{ err.slug }}</span>: {{ err.message }}</span>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </section>
</template>
