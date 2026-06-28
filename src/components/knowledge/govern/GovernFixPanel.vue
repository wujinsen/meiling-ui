<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Sparkles, Square, XCircle } from 'lucide-vue-next'
import type { KbWikiGovernOptions, KbWikiLintIssue } from '@/types/knowledge'
import {
  buildReviseTargets,
  defaultGovernBatchNo,
  isWikiGovernAiFixable,
  isWikiGovernManualOnly,
  wikiGovernIssueKey,
} from '@/utils/kbWikiGovern'

export type GovernFixProgress = {
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
  llmOptions: KbWikiGovernOptions | null
  optionsLoading: boolean
}>()

const emit = defineEmits<{
  start: [payload: { batchNo: string; topic: string; model: string }]
  cancel: []
}>()

const { t } = useI18n()

const batchNo = ref(defaultGovernBatchNo())
const topic = ref('')
const model = ref('')

const selectedIssues = computed(() =>
  props.issues.filter((issue) => props.selectedKeys.has(wikiGovernIssueKey(issue))),
)

const fixableIssues = computed(() => selectedIssues.value.filter(isWikiGovernAiFixable))
const manualIssues = computed(() => selectedIssues.value.filter(isWikiGovernManualOnly))
const reviseTargets = computed(() => buildReviseTargets(fixableIssues.value))

const modelOptions = computed(() => {
  const items = props.llmOptions?.models ?? []
  return items.map((m) => ({
    value: m.id,
    label: m.displayName ?? m.id,
  }))
})

const llmReady = computed(() => props.llmOptions?.llmAvailable === true)

const providerLabel = computed(() => {
  const p = props.llmOptions?.provider
  return p ? t('knowledge.wikiGovern.llmProviderKb', { provider: p }) : t('knowledge.wikiGovern.llmProviderKbDefault')
})

const canStart = computed(
  () =>
    props.canEdit &&
    !props.fixing &&
    !props.optionsLoading &&
    llmReady.value &&
    reviseTargets.value.length > 0 &&
    !!model.value,
)

const progressPct = computed(() => {
  if (!props.progress?.total) return 0
  return Math.round((props.progress.done / props.progress.total) * 100)
})

function applyOptionsDefaults() {
  const o = props.llmOptions
  if (!o) return
  model.value = o.defaultModel ?? modelOptions.value[0]?.value ?? ''
}

function startFix() {
  if (!canStart.value) return
  emit('start', {
    batchNo: batchNo.value.trim() || defaultGovernBatchNo(),
    topic: topic.value.trim() || t('knowledge.wikiGovern.defaultTopic'),
    model: model.value,
  })
}

watch(
  () => props.llmOptions,
  () => applyOptionsDefaults(),
  { immediate: true },
)

onMounted(() => applyOptionsDefaults())
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/40">
    <header class="border-b border-gray-100 px-4 py-3 dark:border-white/5">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('knowledge.wikiGovern.fixPanelTitle') }}
      </h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ t('knowledge.wikiGovern.fixPanelHintAiOnly') }}
      </p>
    </header>

    <div class="space-y-4 px-4 py-4">
      <p v-if="!canEdit" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        {{ t('knowledge.wikiGovern.readOnlyHint') }}
      </p>

      <p
        v-else-if="!optionsLoading && !llmReady"
        class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
      >
        {{ t('knowledge.wikiGovern.llmNotConfigured') }}
      </p>

      <div v-if="!selectedIssues.length" class="py-6 text-center text-sm text-gray-400">
        {{ t('knowledge.wikiGovern.fixNoSelection') }}
      </div>

      <template v-else>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            {{ t('knowledge.wikiGovern.fixAiTargets', { count: reviseTargets.length }) }}
          </span>
          <span v-if="manualIssues.length" class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {{ t('knowledge.wikiGovern.fixManual', { count: manualIssues.length }) }}
          </span>
        </div>

        <div v-if="manualIssues.length" class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.fixManualHint') }}
        </div>

        <p v-if="llmReady" class="text-xs text-gray-500 dark:text-gray-400">
          {{ providerLabel }}
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-xs sm:col-span-2">
            <span class="mb-1 block text-gray-500">{{ t('knowledge.wikiGovern.llmModel') }}</span>
            <select v-model="model" class="input w-full text-sm" :disabled="fixing || optionsLoading || !modelOptions.length">
              <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </label>
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

        <ul v-if="reviseTargets.length" class="max-h-40 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/5">
          <li
            v-for="target in reviseTargets"
            :key="target.slug"
            class="border-b border-gray-50 px-3 py-2 text-xs last:border-0 dark:border-white/5"
          >
            <span class="font-mono text-indigo-700 dark:text-indigo-300">{{ target.slug }}</span>
            <span class="ml-2 text-gray-400">×{{ target.issues.length }}</span>
          </li>
        </ul>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-primary text-sm" :disabled="!canStart" @click="startFix">
            <Loader2 v-if="fixing" class="h-4 w-4 animate-spin" />
            <Sparkles v-else class="h-4 w-4" />
            {{
              fixing
                ? t('knowledge.wikiGovern.fixRunning')
                : t('knowledge.wikiGovern.startAiFix')
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
              {{ t('knowledge.wikiGovern.reviseProgress', { done: progress.done, total: progress.total }) }}
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
