<script setup lang="ts">

import { computed, onMounted, ref, watch } from 'vue'

import { useRouter } from 'vue-router'

import { useI18n } from 'vue-i18n'

import { ExternalLink, Loader2, ScanLine } from 'lucide-vue-next'

import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'

import GovernLintPanel from '@/components/knowledge/govern/GovernLintPanel.vue'

import GovernFixPanel, {

  type GovernFixMode,

  type GovernFixProgress,

} from '@/components/knowledge/govern/GovernFixPanel.vue'

import GovernRelintBar from '@/components/knowledge/govern/GovernRelintBar.vue'

import GovernSyncPanel from '@/components/knowledge/govern/GovernSyncPanel.vue'

import {

  aiReviseKbWikiApi,

  enrichKbWikiApi,

  getKbWikiPageApi,

  lintWikiSpaceApi,

  saveKbWikiPageApi,

} from '@/api/knowledge'

import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'

import { useKbSpace } from '@/composables/useKbSpace'

import { showToast } from '@/composables/useToast'

import { API_SUCCESS_CODE } from '@/types/api'

import type { KbWikiLintIssue, KbWikiSpaceLintResult } from '@/types/knowledge'

import {

  buildEnrichTargets,

  buildReviseTargets,

  isWikiGovernAiReviseable,

  isWikiGovernEnrichable,

  isWikiGovernSyncReady,

  wikiGovernIssueKey,

} from '@/utils/kbWikiGovern'



type GovernPhase = 'idle' | 'linted' | 'fixing' | 'relinted' | 'synced'



const { t } = useI18n()

const router = useRouter()

const { selectedSpaceId, ensureSpacesLoaded, kbSpaceQuery, resolveSelectedSpace } = useKbSpace()



const phase = ref<GovernPhase>('idle')

const strictLint = ref(false)

const lintLoading = ref(false)

const relinting = ref(false)

const lintResult = ref<KbWikiSpaceLintResult | null>(null)

const baselineLint = ref<KbWikiSpaceLintResult | null>(null)

const relintResult = ref<KbWikiSpaceLintResult | null>(null)

const selectedKeys = ref(new Set<string>())

const fixing = ref(false)

const fixCancelled = ref(false)

const fixProgress = ref<GovernFixProgress | null>(null)



const canEdit = computed(() => {
  if (selectedSpaceId.value == null) return false
  return resolveSelectedSpace()?.canEdit === true
})



const spaceRequired = computed(() => selectedSpaceId.value == null)

const displayLint = computed(() => relintResult.value ?? lintResult.value)

const relintDone = computed(() => relintResult.value != null)

const syncReady = computed(() => isWikiGovernSyncReady(relintResult.value, strictLint.value))



async function runLint(options?: { asRelint?: boolean }) {

  if (spaceRequired.value) {

    showToast('error', t('knowledge.wikiGovern.pickSpace'))

    return

  }

  if (!canEdit.value) {

    showToast('error', t('knowledge.wikiGovern.readOnlyHint'))

    return

  }



  const asRelint = options?.asRelint === true

  if (asRelint) relinting.value = true

  else lintLoading.value = true



  try {

    const scope = kbSpaceQuery()

    if (!scope.spaceId) {

      showToast('error', t('knowledge.wikiGovern.pickSpace'))

      return

    }

    if (!scope.spaceCode) {

      showToast('error', t('knowledge.space.spaceResolveFailed'))

      return

    }

    const res = await lintWikiSpaceApi({

      ...scope,

      strict: strictLint.value,

    })

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

    if (asRelint) {

      relintResult.value = data

      phase.value = 'relinted'

      showToast('success', t('knowledge.wikiGovern.relintOk'))

    } else {

      lintResult.value = data

      baselineLint.value = data

      relintResult.value = null

      selectedKeys.value = new Set()

      fixProgress.value = null

      phase.value = 'linted'

      showToast('success', t('knowledge.wikiGovern.lintOk', { count: data.issues.length }))

    }

  } catch (e) {

    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiGovern.lintFailed'))

  } finally {

    if (asRelint) relinting.value = false

    else lintLoading.value = false

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



async function runBatchFix(payload: {

  mode: GovernFixMode

  batchNo: string

  topic: string

  appendGovernance: boolean

}) {

  if (!lintResult.value || fixing.value || !canEdit.value) return



  const issues = lintResult.value.issues.filter((issue) => selectedKeys.value.has(wikiGovernIssueKey(issue)))



  if (payload.mode === 'enrich') {

    await runBatchEnrich(payload, issues)

  } else {

    await runBatchAiRevise(payload, issues)

  }

}



async function runBatchEnrich(

  payload: { batchNo: string; topic: string; appendGovernance: boolean },

  issues: KbWikiLintIssue[],

) {

  const targets = buildEnrichTargets(issues)

  const skipped = issues.filter((i) => !isWikiGovernEnrichable(i)).length

  if (!targets.length) {

    showToast('error', t('knowledge.wikiGovern.fixNoEnrichable'))

    return

  }

  await runFixLoop('enrich', targets.length, skipped, async (index) => {

    const target = targets[index]!

    const spaceId = selectedSpaceId.value ?? undefined

    const res = await enrichKbWikiApi({

      spaceId,

      slug: target.slug,

      patch: target.patch,

      batchNo: payload.batchNo,

      topic: payload.topic,

      updateMeta: true,

      appendLog: payload.appendGovernance,

      appendIndex: payload.appendGovernance,

      appendEdges: payload.appendGovernance,

      dryRun: false,

      sync: false,

    })

    if (res.code !== API_SUCCESS_CODE || !res.data) {

      throw new Error(res.msg || t('knowledge.wikiGovern.enrichFailed'))

    }

    const item = res.data.items?.[0]

    if (item?.error) throw new Error(item.error)

    if (item?.applied === false) throw new Error(t('knowledge.wikiGovern.enrichNotApplied'))

    return target.slug

  }, targets.map((t) => t.slug))

}



async function runBatchAiRevise(

  payload: { batchNo: string; topic: string },

  issues: KbWikiLintIssue[],

) {

  const targets = buildReviseTargets(issues)

  const skipped = issues.filter((i) => !isWikiGovernAiReviseable(i)).length

  if (!targets.length) {

    showToast('error', t('knowledge.wikiGovern.fixNoReviseable'))

    return

  }



  const spaceId = selectedSpaceId.value ?? undefined



  await runFixLoop('ai-revise', targets.length, skipped, async (index) => {

    const target = targets[index]!

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

    return target.slug

  }, targets.map((t) => t.slug))

}



async function runFixLoop(

  mode: GovernFixMode,

  total: number,

  skipped: number,

  runOne: (index: number) => Promise<string>,

  slugs: string[],

) {

  fixing.value = true

  fixCancelled.value = false

  phase.value = 'fixing'

  fixProgress.value = {

    mode,

    total,

    done: 0,

    ok: 0,

    failed: 0,

    skipped,

    errors: [],

  }



  for (let i = 0; i < total; i++) {

    if (fixCancelled.value) break

    const slug = slugs[i]!

    fixProgress.value = { ...fixProgress.value!, currentSlug: slug }

    try {

      await runOne(i)

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

        errors: [...fixProgress.value!.errors, { slug, message }],

      }

    }

  }



  fixProgress.value = { ...fixProgress.value!, currentSlug: undefined }

  fixing.value = false

  phase.value = 'linted'

  relintResult.value = null



  const prog = fixProgress.value

  if (prog) {

    showToast(

      prog.failed ? 'error' : 'success',

      t('knowledge.wikiGovern.fixSummary', { ok: prog.ok, failed: prog.failed, skipped: prog.skipped }),

    )

    if (prog.ok > 0) {
      /* 修复后请使用下方复检 */
    }

  }

}



function cancelFix() {

  fixCancelled.value = true

}



function onSynced() {

  phase.value = 'synced'

  showToast('success', t('knowledge.wikiGovern.syncDone'))

}



function openWikiEdit(issue: KbWikiLintIssue) {

  void router.push(kbWikiEditPath(issue.page, selectedSpaceId.value ?? undefined))

}



function openIngest() {

  void router.push({ name: 'KnowledgeIngest' })

}



watch(selectedSpaceId, () => {

  phase.value = 'idle'

  lintResult.value = null

  baselineLint.value = null

  relintResult.value = null

  selectedKeys.value = new Set()

  fixProgress.value = null

})



onMounted(() => {

  void ensureSpacesLoaded()

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

      <span v-if="displayLint?.wikiDir" class="font-mono text-gray-400">

        {{ displayLint.spaceCode }} / {{ displayLint.wikiDir }}

      </span>

    </div>



    <GovernLintPanel

      :result="displayLint"

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

      @start="runBatchFix"

      @cancel="cancelFix"

    />



    <GovernRelintBar

      v-if="baselineLint"

      :baseline="baselineLint"

      :current="relintResult"

      :relinting="relinting"

      :can-edit="canEdit"

      @relint="runLint({ asRelint: true })"

    />



    <GovernSyncPanel

      v-if="baselineLint"

      :sync-ready="syncReady"

      :relint-done="relintDone"

      :strict="strictLint"

      :can-edit="canEdit"

      @synced="onSynced"

    />



    <section class="rounded-xl border border-dashed border-gray-200 px-4 py-3 dark:border-white/10">

      <div class="flex flex-wrap items-center justify-between gap-3">

        <div>

          <h3 class="text-sm font-medium text-gray-800 dark:text-gray-100">

            {{ t('knowledge.wikiGovern.ingestBypassTitle') }}

          </h3>

          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">

            {{ t('knowledge.wikiGovern.ingestBypassHint') }}

          </p>

        </div>

        <button type="button" class="btn-ghost text-sm" @click="openIngest">

          <ExternalLink class="h-4 w-4" /> {{ t('knowledge.wikiGovern.openIngest') }}

        </button>

      </div>

    </section>



    <section v-if="displayLint?.issues.length" class="text-xs text-gray-400">

      <button

        v-for="issue in displayLint.issues.slice(0, 3)"

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

