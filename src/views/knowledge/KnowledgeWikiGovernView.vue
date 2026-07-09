<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2, ScanLine } from 'lucide-vue-next'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import GovernLintPanel from '@/components/knowledge/govern/GovernLintPanel.vue'
import GovernFixPanel from '@/components/knowledge/govern/GovernFixPanel.vue'
import GovernRelintBar from '@/components/knowledge/govern/GovernRelintBar.vue'
import GovernMergeHintPanel from '@/components/knowledge/govern/GovernMergeHintPanel.vue'
import GovernSyncPanel from '@/components/knowledge/govern/GovernSyncPanel.vue'
import KbGovernWorkflowLinks from '@/components/knowledge/govern/KbGovernWorkflowLinks.vue'
import {
  getKbWikiGovernOptionsApi,
  lintWikiSpaceApi,
  wikiGovernAiBatchFixApi,
  wikiGovernAutoFixApi,
  wikiGovernMergeHintApi,
  wikiGovernScriptFixApi,
} from '@/api/knowledge'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { useKbSpace } from '@/composables/useKbSpace'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  KbWikiGovernAutoFixResult,
  KbWikiGovernOptions,
  KbWikiLintIssue,
  KbWikiSpaceLintResult,
  WikiGovernMergeHintItem,
} from '@/types/knowledge'
import {
  buildDefaultSelectedKeys,
  buildSelectedIssues,
  isAiFixable,
  isGovernSyncReady,
  isManualOnlyKind,
  isScriptFixable,
  isSelectableForBatch,
  resolveAiKinds,
  resolveManualKinds,
  resolveScriptKinds,
} from '@/utils/kbWikiGovern'

type GovernPhase = 'idle' | 'linted' | 'fixing' | 'relinted' | 'synced'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { selectedSpaceId, ensureSpacesLoaded, kbSpaceQuery, resolveSelectedSpace, setSelectedSpaceId } = useKbSpace()

const phase = ref<GovernPhase>('idle')
const strictLint = ref(false)
const lintLoading = ref(false)
const lintResult = ref<KbWikiSpaceLintResult | null>(null)
const selectedKeys = ref(new Set<string>())
const fixing = ref(false)
const llmOptions = ref<KbWikiGovernOptions | null>(null)
const optionsLoading = ref(false)
const lastFixResult = ref<KbWikiGovernAutoFixResult | null>(null)
const lintBaseline = ref<KbWikiSpaceLintResult | null>(null)
const relintResult = ref<KbWikiSpaceLintResult | null>(null)
const mergeHintOpen = ref(false)
const mergeHintItems = ref<WikiGovernMergeHintItem[]>([])

const canEdit = computed(() => {
  if (selectedSpaceId.value == null) return false
  return resolveSelectedSpace()?.canEdit === true
})

const spaceRequired = computed(() => selectedSpaceId.value == null)

const llmReady = computed(() => llmOptions.value?.llmAvailable === true)

const relintDone = computed(
  () =>
    relintResult.value != null
    || lastFixResult.value?.relint != null
    || phase.value === 'relinted'
    || phase.value === 'synced',
)

const latestLintSnapshot = computed(
  () => relintResult.value ?? lastFixResult.value?.relint ?? lintResult.value,
)

const governSyncReady = computed(() => isGovernSyncReady(latestLintSnapshot.value, strictLint.value))

function selectedIssues(): KbWikiLintIssue[] {
  return buildSelectedIssues(lintResult.value?.issues ?? [], selectedKeys.value)
}

async function loadGovernOptions() {
  optionsLoading.value = true
  try {
    const res = await getKbWikiGovernOptionsApi()
    if (res.code === API_SUCCESS_CODE && res.data) {
      llmOptions.value = res.data
    }
  } catch {
    llmOptions.value = null
  } finally {
    optionsLoading.value = false
  }
}

async function runLint() {
  if (spaceRequired.value) {
    showToast('error', t('knowledge.wikiGovern.pickSpace'))
    return
  }
  if (!canEdit.value) {
    showToast('error', t('knowledge.wikiGovern.readOnlyHint'))
    return
  }

  lintLoading.value = true
  try {
    const scope = kbSpaceQuery()
    if (!scope.spaceId || !scope.spaceCode) {
      showToast('error', t('knowledge.wikiGovern.pickSpace'))
      return
    }
    const res = await lintWikiSpaceApi({ ...scope, strict: strictLint.value })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.wikiGovern.lintFailed'))
    }
    const data = res.data
    if (data.spaceCode && data.spaceCode !== scope.spaceCode) {
      showToast('error', t('knowledge.wikiGovern.lintSpaceMismatch', {
        expected: scope.spaceCode,
        got: data.spaceCode,
      }))
      return
    }
    lintResult.value = data
    lintBaseline.value = data
    relintResult.value = null
    selectedKeys.value = buildDefaultSelectedKeys(data.issues, llmOptions.value)
    lastFixResult.value = null
    phase.value = 'linted'
    showToast('success', t('knowledge.wikiGovern.lintOk', { count: data.issues.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.lintFailed'))
  } finally {
    lintLoading.value = false
  }
}

function applyRelint(data: KbWikiSpaceLintResult) {
  relintResult.value = data
  lintResult.value = data
  selectedKeys.value = buildDefaultSelectedKeys(data.issues, llmOptions.value)
  phase.value = 'relinted'
}

async function runRelint(silent = false) {
  if (spaceRequired.value || !canEdit.value || lintLoading.value) return false
  const scope = kbSpaceQuery()
  if (!scope.spaceId) return false
  lintLoading.value = true
  try {
    const res = await lintWikiSpaceApi({ ...scope, strict: strictLint.value })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.wikiGovern.lintFailed'))
    applyRelint(res.data)
    if (!silent) showToast('success', t('knowledge.wikiGovern.relintOk'))
    return true
  } catch (e) {
    if (!silent) showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.lintFailed'))
    return false
  } finally {
    lintLoading.value = false
  }
}

function toastFixResult(label: string, fixed: number, skipped: number, failed: number) {
  showToast(failed > 0 ? 'error' : 'success', `${label}：${t('knowledge.wikiGovern.fixResult', { fixed, skipped, failed })}`)
}

async function runScriptFix() {
  const spaceId = selectedSpaceId.value
  if (!spaceId || fixing.value || !canEdit.value) return

  const scriptKinds = resolveScriptKinds(llmOptions.value)
  const issues = selectedIssues().filter((i) => isScriptFixable(i.kind, scriptKinds))
  if (!issues.length) {
    showToast('error', t('knowledge.wikiGovern.fixNoSelection'))
    return
  }

  fixing.value = true
  phase.value = 'fixing'
  try {
    const res = await wikiGovernScriptFixApi({ spaceId, issues })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.wikiGovern.fixFailed'))
    lastFixResult.value = {
      issuesBefore: lintResult.value?.issues.length ?? issues.length,
      scriptFix: res.data,
    }
    toastFixResult(t('knowledge.wikiGovern.fixScript'), res.data.fixedPages, res.data.skippedPages, res.data.failedPages)
    await runRelint(true)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.fixFailed'))
  } finally {
    fixing.value = false
    phase.value = 'linted'
  }
}

async function runAiFix(payload: { model: string }) {
  const spaceId = selectedSpaceId.value
  if (!spaceId || fixing.value || !canEdit.value || !llmReady.value) return

  const aiKinds = resolveAiKinds(llmOptions.value)
  const manualKinds = resolveManualKinds(llmOptions.value)
  const issues = selectedIssues().filter(
    (i) => !isManualOnlyKind(i.kind, manualKinds) && isAiFixable(i.kind, aiKinds),
  )
  if (!issues.length) {
    showToast('error', t('knowledge.wikiGovern.fixNoSelection'))
    return
  }

  fixing.value = true
  phase.value = 'fixing'
  try {
    const res = await wikiGovernAiBatchFixApi({ spaceId, issues, model: payload.model })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.wikiGovern.fixFailed'))
    lastFixResult.value = {
      issuesBefore: lintResult.value?.issues.length ?? issues.length,
      aiFix: res.data,
    }
    toastFixResult(t('knowledge.wikiGovern.fixAi'), res.data.fixedPages, res.data.skippedPages, res.data.failedPages)
    showToast('success', t('knowledge.wikiGovern.rerunLintHint'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.fixFailed'))
  } finally {
    fixing.value = false
    phase.value = 'linted'
  }
}

async function runAutoFix(payload: { syncAfter: boolean; strict: boolean; model: string }) {
  const spaceId = selectedSpaceId.value
  if (!spaceId || fixing.value || !canEdit.value) return

  const issues = selectedIssues().filter((i) => isSelectableForBatch(i, llmOptions.value))
  if (!issues.length) {
    showToast('error', t('knowledge.wikiGovern.fixNoSelection'))
    return
  }

  const aiKinds = resolveAiKinds(llmOptions.value)
  const manualKinds = resolveManualKinds(llmOptions.value)
  const hasAi = llmReady.value && issues.some((i) => !isManualOnlyKind(i.kind, manualKinds) && isAiFixable(i.kind, aiKinds))

  fixing.value = true
  phase.value = 'fixing'
  try {
    const res = await wikiGovernAutoFixApi({
      spaceId,
      issues,
      model: hasAi ? payload.model : undefined,
      scriptFix: true,
      aiFix: hasAi,
      relintAfter: true,
      strict: payload.strict,
      syncAfter: payload.syncAfter,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.wikiGovern.fixFailed'))

    lastFixResult.value = res.data
    if (res.data.relint) applyRelint(res.data.relint)
    if (payload.syncAfter && res.data.sync?.success) phase.value = 'synced'
    else if (payload.syncAfter && res.data.sync && !res.data.sync.success) {
      showToast('error', t('knowledge.sync.failCheckLogs'))
    }

    if (res.data.issuesAfter != null) {
      showToast(
        res.data.scriptFix?.failedPages || res.data.aiFix?.failedPages ? 'error' : 'success',
        t('knowledge.wikiGovern.fixRelint', {
          before: res.data.issuesBefore,
          after: res.data.issuesAfter,
        }),
      )
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.fixFailed'))
  } finally {
    fixing.value = false
    if (phase.value === 'fixing') phase.value = lintResult.value ? 'linted' : 'idle'
  }
}

async function openMergeHint(issue: KbWikiLintIssue) {
  const spaceId = selectedSpaceId.value
  if (!spaceId) return
  try {
    const res = await wikiGovernMergeHintApi({ spaceId, issues: [issue] })
    if (res.code !== API_SUCCESS_CODE || !res.data?.items?.length) {
      throw new Error(res.msg || t('knowledge.wikiGovern.mergeHintFailed'))
    }
    mergeHintItems.value = res.data.items
    mergeHintOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.mergeHintFailed'))
  }
}

function onSelectedKeysUpdate(keys: Set<string>) {
  selectedKeys.value = keys
}

function openWikiEdit(issue: KbWikiLintIssue) {
  void router.push(
    kbWikiEditPath(issue.page, selectedSpaceId.value ?? undefined, {
      issueType: issue.kind,
      issueDetail: issue.detail,
    }),
  )
}

function applyRouteQuery() {
  const qSpace = route.query.spaceId
  if (typeof qSpace === 'string' && qSpace.trim()) {
    setSelectedSpaceId(qSpace.trim())
  }
}

watch(selectedSpaceId, () => {
  phase.value = 'idle'
  lintResult.value = null
  lintBaseline.value = null
  relintResult.value = null
  selectedKeys.value = new Set()
  lastFixResult.value = null
})

onMounted(async () => {
  await ensureSpacesLoaded()
  applyRouteQuery()
  void loadGovernOptions()
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('knowledge.wikiGovern.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.subtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <KbSpaceSelector editable-only />
        <label class="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input v-model="strictLint" type="checkbox" class="h-4 w-4 rounded" :disabled="lintLoading" />
          {{ t('knowledge.wikiGovern.strictLint') }}
        </label>
        <button
          type="button"
          class="btn-primary text-sm"
          :disabled="lintLoading || spaceRequired || !canEdit"
          :title="spaceRequired ? t('knowledge.wikiGovern.pickSpace') : undefined"
          @click="runLint()"
        >
          <Loader2 v-if="lintLoading" class="h-4 w-4 animate-spin" />
          <ScanLine v-else class="h-4 w-4" />
          {{ lintLoading ? t('knowledge.wikiGovern.lintRunning') : t('knowledge.wikiGovern.startLint') }}
        </button>
      </div>
    </header>

    <p v-if="spaceRequired" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      {{ t('knowledge.wikiGovern.pickSpace') }}
    </p>

    <div v-if="phase !== 'idle'" class="flex flex-wrap items-center gap-2 text-xs">
      <span class="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
        {{ t(`knowledge.wikiGovern.phase.${phase}`) }}
      </span>
      <span v-if="lintResult?.wikiDir" class="font-mono text-gray-400">
        {{ lintResult.spaceCode }} / {{ lintResult.wikiDir }}
      </span>
    </div>

    <KbGovernWorkflowLinks :space-id="selectedSpaceId" />

    <GovernLintPanel
      :result="lintResult"
      :loading="lintLoading"
      :selected-keys="selectedKeys"
      :govern-options="llmOptions"
      @update:selected-keys="onSelectedKeysUpdate"
      @merge-hint="openMergeHint"
      @open-page="openWikiEdit"
    />

    <GovernFixPanel
      :issues="lintResult?.issues ?? []"
      :selected-keys="selectedKeys"
      :fixing="fixing"
      :can-edit="canEdit"
      :llm-options="llmOptions"
      :options-loading="optionsLoading"
      :last-result="lastFixResult"
      :space-id="selectedSpaceId"
      @script-fix="runScriptFix"
      @ai-fix="runAiFix"
      @auto-fix="runAutoFix"
    />

    <GovernRelintBar
      :baseline="lintBaseline"
      :current="relintResult ?? (lastFixResult?.relint ?? null)"
      :relinting="lintLoading"
      :can-edit="canEdit"
      :space-id="selectedSpaceId"
      @relint="runRelint()"
    />

    <GovernSyncPanel
      v-if="lintBaseline"
      :sync-ready="governSyncReady"
      :relint-done="relintDone"
      :strict="strictLint"
      :can-edit="canEdit"
      @synced="phase = 'synced'"
    />

    <GovernMergeHintPanel
      :open="mergeHintOpen"
      :items="mergeHintItems"
      @close="mergeHintOpen = false"
    />
  </div>
</template>
