<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Sparkles, Wand2, Wrench } from 'lucide-vue-next'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import type {
  KbWikiGovernAutoFixResult,
  KbWikiGovernOptions,
  KbWikiLintIssue,
} from '@/types/knowledge'
import {
  buildSelectedIssues,
  isAiFixable,
  isManualOnlyKind,
  isScriptFixable,
  resolveAiKinds,
  resolveManualKinds,
  resolveScriptKinds,
  summarizeFixPages,
} from '@/utils/kbWikiGovern'

const props = defineProps<{
  issues: KbWikiLintIssue[]
  selectedKeys: Set<string>
  fixing: boolean
  canEdit: boolean
  llmOptions: KbWikiGovernOptions | null
  optionsLoading: boolean
  lastResult: KbWikiGovernAutoFixResult | null
}>()

const emit = defineEmits<{
  scriptFix: []
  aiFix: [payload: { model: string }]
  autoFix: [payload: { syncAfter: boolean; strict: boolean; model: string }]
}>()

const { t } = useI18n()

const model = ref('')
const syncAfter = ref(false)
const strictRelint = ref(false)

const scriptKinds = computed(() => resolveScriptKinds(props.llmOptions))
const aiKinds = computed(() => resolveAiKinds(props.llmOptions))
const manualKinds = computed(() => resolveManualKinds(props.llmOptions))

const selectedIssues = computed(() => buildSelectedIssues(props.issues, props.selectedKeys))

const scriptIssues = computed(() =>
  selectedIssues.value.filter((i) => isScriptFixable(i.kind, scriptKinds.value)),
)
const aiIssues = computed(() =>
  selectedIssues.value.filter(
    (i) => !isManualOnlyKind(i.kind, manualKinds.value) && isAiFixable(i.kind, aiKinds.value),
  ),
)
const manualIssues = computed(() =>
  selectedIssues.value.filter((i) => isManualOnlyKind(i.kind, manualKinds.value)),
)

const modelOptions = computed(() =>
  (props.llmOptions?.models ?? []).map((m) => ({
    value: m.id,
    label: m.displayName ?? m.id,
  })),
)

const llmReady = computed(() => props.llmOptions?.llmAvailable === true)

const canScript = computed(
  () => props.canEdit && !props.fixing && !props.optionsLoading && scriptIssues.value.length > 0,
)
const canAi = computed(
  () =>
    props.canEdit &&
    !props.fixing &&
    !props.optionsLoading &&
    llmReady.value &&
    aiIssues.value.length > 0 &&
    !!model.value,
)
const canAuto = computed(() => {
  if (!props.canEdit || props.fixing || props.optionsLoading) return false
  const hasScript = scriptIssues.value.length > 0
  const hasAi = llmReady.value && aiIssues.value.length > 0 && !!model.value
  return hasScript || hasAi
})

const relintSummary = computed(() => {
  const r = props.lastResult
  if (!r || r.issuesAfter == null) return null
  return { before: r.issuesBefore, after: r.issuesAfter }
})

const scriptSummary = computed(() => summarizeFixPages(props.lastResult?.scriptFix?.pages))

const aiSummary = computed(() => summarizeFixPages(props.lastResult?.aiFix?.pages))

const failedPages = computed(() => {
  const pages = [
    ...(props.lastResult?.scriptFix?.pages ?? []),
    ...(props.lastResult?.aiFix?.pages ?? []),
  ]
  return pages.filter((p) => p.status === 'failed')
})

function applyModelDefault() {
  const o = props.llmOptions
  if (!o) return
  model.value = o.defaultModel ?? modelOptions.value[0]?.value ?? ''
}

watch(() => props.llmOptions, applyModelDefault, { immediate: true })
onMounted(applyModelDefault)
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

      <p
        v-else-if="!optionsLoading && !llmReady"
        class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{ t('knowledge.wikiGovern.llmUnavailable') }}
      </p>

      <div v-if="!selectedIssues.length" class="py-6 text-center text-sm text-gray-400">
        {{ t('knowledge.wikiGovern.fixNoSelection') }}
      </div>

      <template v-else>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {{ t('knowledge.wikiGovern.fixScriptTargets', { count: scriptIssues.length }) }}
          </span>
          <span class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            {{ t('knowledge.wikiGovern.fixAiTargets', { count: aiIssues.length }) }}
          </span>
          <span v-if="manualIssues.length" class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {{ t('knowledge.wikiGovern.fixManual', { count: manualIssues.length }) }}
          </span>
        </div>

        <p v-if="manualIssues.length" class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.fixManualHint') }}
        </p>

        <label class="block text-xs sm:max-w-md">
          <span class="mb-1 block text-gray-500">{{ t('knowledge.wikiGovern.fixModel') }}</span>
          <select
            v-model="model"
            class="field-input w-full text-sm"
            :disabled="fixing || optionsLoading || !modelOptions.length || !llmReady"
          >
            <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <div class="flex flex-wrap gap-3">
          <AppCheckbox v-model="syncAfter" :disabled="fixing">
            {{ t('knowledge.wikiGovern.fixSyncAfter') }}
          </AppCheckbox>
          <AppCheckbox v-model="strictRelint" :disabled="fixing">
            {{ t('knowledge.wikiGovern.strictLint') }}
          </AppCheckbox>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-ghost border border-gray-200 text-sm dark:border-white/10" :disabled="!canScript" @click="emit('scriptFix')">
            <Loader2 v-if="fixing" class="h-4 w-4 animate-spin" />
            <Wrench v-else class="h-4 w-4" />
            {{ t('knowledge.wikiGovern.fixScript') }}
          </button>
          <button type="button" class="btn-ghost border border-gray-200 text-sm dark:border-white/10" :disabled="!canAi" @click="emit('aiFix', { model })">
            <Loader2 v-if="fixing" class="h-4 w-4 animate-spin" />
            <Sparkles v-else class="h-4 w-4" />
            {{ t('knowledge.wikiGovern.fixAi') }}
          </button>
          <button type="button" class="btn-primary text-sm" :disabled="!canAuto" @click="emit('autoFix', { syncAfter, strict: strictRelint, model })">
            <Loader2 v-if="fixing" class="h-4 w-4 animate-spin" />
            <Wand2 v-else class="h-4 w-4" />
            {{ fixing ? t('knowledge.wikiGovern.fixRunning') : t('knowledge.wikiGovern.fixAuto') }}
          </button>
        </div>

        <div
          v-if="lastResult"
          class="space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-xs dark:border-white/5 dark:bg-white/5"
        >
          <p v-if="relintSummary" class="font-medium text-brand-800 dark:text-brand-200">
            {{ t('knowledge.wikiGovern.fixRelint', relintSummary) }}
          </p>
          <p v-if="lastResult.scriptFix" class="text-gray-600 dark:text-gray-400">
            {{ t('knowledge.wikiGovern.fixScript') }}：
            {{
              t('knowledge.wikiGovern.fixResult', {
                fixed: lastResult.scriptFix.fixedPages ?? scriptSummary.fixed,
                skipped: lastResult.scriptFix.skippedPages ?? scriptSummary.skipped,
                failed: lastResult.scriptFix.failedPages ?? scriptSummary.failed,
              })
            }}
          </p>
          <p v-if="lastResult.aiFix" class="text-gray-600 dark:text-gray-400">
            {{ t('knowledge.wikiGovern.fixAi') }}：
            {{
              t('knowledge.wikiGovern.fixResult', {
                fixed: lastResult.aiFix.fixedPages ?? aiSummary.fixed,
                skipped: lastResult.aiFix.skippedPages ?? aiSummary.skipped,
                failed: lastResult.aiFix.failedPages ?? aiSummary.failed,
              })
            }}
            <span v-if="lastResult.aiFix.model" class="text-gray-400">({{ lastResult.aiFix.model }})</span>
          </p>
          <p v-if="lastResult.sync" class="text-emerald-700 dark:text-emerald-300">
            Sync：{{ lastResult.sync.success ? t('knowledge.wikiGovern.syncDone') : lastResult.sync.outputTail ?? `exit ${lastResult.sync.exitCode}` }}
          </p>
          <ul v-if="failedPages.length" class="max-h-28 space-y-1 overflow-y-auto text-rose-600 dark:text-rose-400">
            <li v-for="p in failedPages" :key="`${p.slug}-${p.message}`">
              <span class="font-mono">{{ p.slug }}</span>
              <span v-if="p.message"> — {{ p.message }}</span>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </section>
</template>
