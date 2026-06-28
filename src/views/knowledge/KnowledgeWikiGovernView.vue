<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2, ScanLine } from 'lucide-vue-next'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import GovernLintPanel from '@/components/knowledge/govern/GovernLintPanel.vue'
import GovernFixPanel, { type GovernFixProgress } from '@/components/knowledge/govern/GovernFixPanel.vue'
import {
  aiReviseKbWikiApi,
  getKbWikiGovernOptionsApi,
  getKbWikiPageApi,
  lintWikiSpaceApi,
  saveKbWikiPageApi,
} from '@/api/knowledge'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { useKbSpace } from '@/composables/useKbSpace'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbWikiGovernOptions, KbWikiLintIssue, KbWikiSpaceLintResult } from '@/types/knowledge'
import {
  buildReviseTargets,
  isWikiGovernAiFixable,
  wikiGovernIssueKey,
} from '@/utils/kbWikiGovern'

type GovernPhase = 'idle' | 'linted' | 'fixing'

const { t } = useI18n()
const router = useRouter()
const { selectedSpaceId, ensureSpacesLoaded, kbSpaceQuery, resolveSelectedSpace } = useKbSpace()

const phase = ref<GovernPhase>('idle')
const strictLint = ref(false)
const lintLoading = ref(false)
const lintResult = ref<KbWikiSpaceLintResult | null>(null)
const selectedKeys = ref(new Set<string>())
const fixing = ref(false)
const fixCancelled = ref(false)
const fixProgress = ref<GovernFixProgress | null>(null)
const llmOptions = ref<KbWikiGovernOptions | null>(null)
const optionsLoading = ref(false)

const canEdit = computed(() => {
  if (selectedSpaceId.value == null) return false
  return resolveSelectedSpace()?.canEdit === true
})

const spaceRequired = computed(() => selectedSpaceId.value == null)

async function loadLlmOptions() {
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
    selectedKeys.value = new Set()
    fixProgress.value = null
    phase.value = 'linted'
    showToast('success', t('knowledge.wikiGovern.lintOk', { count: data.issues.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.lintFailed'))
  } finally {
    lintLoading.value = false
  }
}

function onSelectedKeysUpdate(keys: Set<string>) {
  selectedKeys.value = keys
}

function parseAiSuggested(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  const raw = d.suggestedContent ?? d.suggested_content ?? d.content
  return typeof raw === 'string' ? raw.trim() : ''
}

async function runBatchAiFix(payload: {
  batchNo: string
  topic: string
  model: string
}) {
  if (!lintResult.value || fixing.value || !canEdit.value) return

  const issues = lintResult.value.issues.filter((issue) =>
    selectedKeys.value.has(wikiGovernIssueKey(issue)),
  )
  const targets = buildReviseTargets(issues)
  const skipped = issues.filter((i) => !isWikiGovernAiFixable(i)).length

  if (!targets.length) {
    showToast('error', t('knowledge.wikiGovern.fixNoReviseable'))
    return
  }

  const spaceId = selectedSpaceId.value ?? undefined

  fixing.value = true
  fixCancelled.value = false
  phase.value = 'fixing'
  fixProgress.value = {
    total: targets.length,
    done: 0,
    ok: 0,
    failed: 0,
    skipped,
    errors: [],
  }

  for (let i = 0; i < targets.length; i++) {
    if (fixCancelled.value) break
    const target = targets[i]!
    fixProgress.value = { ...fixProgress.value!, currentSlug: target.slug }
    try {
      const pageRes = await getKbWikiPageApi(target.slug, spaceId)
      if (pageRes.code !== API_SUCCESS_CODE || !pageRes.data) {
        throw new Error(pageRes.msg || t('knowledge.wikiGovern.reviseLoadFailed'))
      }
      const baseline = pageRes.data.content ?? ''
      if (!pageRes.data.exists && !baseline.trim()) {
        throw new Error(t('knowledge.wikiGovern.revisePageMissing'))
      }

      const primaryIssue = target.issues[0]
      const reviseRes = await aiReviseKbWikiApi({
        slug: target.slug,
        spaceId,
        instruction: target.instruction,
        baselineContent: baseline,
        model: payload.model,
        issueContext: primaryIssue
          ? { issueType: primaryIssue.kind, detail: primaryIssue.detail }
          : undefined,
      })
      if (reviseRes.code !== API_SUCCESS_CODE) {
        throw new Error(reviseRes.msg || t('knowledge.wikiGovern.reviseFailed'))
      }
      const suggested = parseAiSuggested(reviseRes.data)
      if (!suggested) throw new Error(t('knowledge.wikiGovern.reviseEmpty'))

      const saveRes = await saveKbWikiPageApi({
        slug: target.slug,
        spaceId,
        content: suggested,
        changeLog: `[${payload.batchNo}] ${payload.topic} · ${target.issues.map((i) => i.kind).join(', ')}`,
        baselineHash: pageRes.data.contentHash,
      })
      if (saveRes.code !== API_SUCCESS_CODE) {
        throw new Error(saveRes.msg || t('knowledge.wikiGovern.reviseSaveFailed'))
      }

      fixProgress.value = {
        ...fixProgress.value!,
        done: fixProgress.value!.done + 1,
        ok: fixProgress.value!.ok + 1,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('knowledge.wikiGovern.fixFailed')
      fixProgress.value = {
        ...fixProgress.value!,
        done: fixProgress.value!.done + 1,
        failed: fixProgress.value!.failed + 1,
        errors: [...fixProgress.value!.errors, { slug: target.slug, message }],
      }
    }
  }

  fixProgress.value = { ...fixProgress.value!, currentSlug: undefined }
  fixing.value = false
  phase.value = 'linted'

  const prog = fixProgress.value
  if (prog) {
    showToast(
      prog.failed ? 'error' : 'success',
      t('knowledge.wikiGovern.fixSummary', { ok: prog.ok, failed: prog.failed, skipped: prog.skipped }),
    )
    if (prog.ok > 0) {
      showToast('success', t('knowledge.wikiGovern.rerunLintHint'))
    }
  }
}

function cancelFix() {
  fixCancelled.value = true
}

function openWikiEdit(issue: KbWikiLintIssue) {
  void router.push(kbWikiEditPath(issue.page, selectedSpaceId.value ?? undefined))
}

watch(selectedSpaceId, () => {
  phase.value = 'idle'
  lintResult.value = null
  selectedKeys.value = new Set()
  fixProgress.value = null
})

onMounted(() => {
  void ensureSpacesLoaded()
  void loadLlmOptions()
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
          {{ t('knowledge.wikiGovern.subtitleAiOnly') }}
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

    <GovernLintPanel
      :result="lintResult"
      :loading="lintLoading"
      :selected-keys="selectedKeys"
      @update:selected-keys="onSelectedKeysUpdate"
    />

    <GovernFixPanel
      v-if="lintResult"
      :issues="lintResult.issues"
      :selected-keys="selectedKeys"
      :fixing="fixing"
      :progress="fixProgress"
      :can-edit="canEdit"
      :llm-options="llmOptions"
      :options-loading="optionsLoading"
      @start="runBatchAiFix"
      @cancel="cancelFix"
    />

    <section v-if="lintResult?.issues.length" class="text-xs text-gray-400">
      <button
        v-for="issue in lintResult.issues.slice(0, 5)"
        :key="wikiGovernIssueKey(issue)"
        type="button"
        class="mr-3 underline hover:text-indigo-600"
        @click="openWikiEdit(issue)"
      >
        {{ t('knowledge.wikiGovern.editPage', { slug: issue.page }) }}
      </button>
    </section>
  </div>
</template>
