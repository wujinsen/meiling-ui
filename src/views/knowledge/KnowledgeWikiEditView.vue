<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ExternalLink, GitMerge, Loader2, Save, Sparkles, Upload } from 'lucide-vue-next'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import {
  aiReviseKbWikiApi,
  getKbLlmConfigApi,
  getKbWikiPageApi,
  enrichKbWikiApi,
  previewKbWikiLintApi,
  saveKbWikiPageApi,
  triggerKbSyncApi,
  updateKbLintIssueApi,
} from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { renderMarkdown } from '@/utils/markdown'
import { toEntityId } from '@/utils/id'
import { diffLines, type DiffRow } from '@/utils/lineDiff'
import { popWikiDraft } from '@/utils/kbWikiDraft'
import type { KbWikiEnrichResult, KbWikiLintPreviewItem } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { assertAction } from '@/composables/useActionPermissions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { spaces, ensureSpacesLoaded } = useKbSpace()

const slug = computed(() => {
  const raw = route.query.slug
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v : ''
})
const querySpaceId = computed(() => {
  const raw = route.query.spaceId
  const v = Array.isArray(raw) ? raw[0] : raw
  return toEntityId(typeof v === 'string' ? v : undefined) ?? undefined
})
const issueId = computed(() => {
  const raw = route.query.issueId
  const v = Array.isArray(raw) ? raw[0] : raw
  return toEntityId(typeof v === 'string' ? v : undefined) ?? undefined
})
const issueType = computed(() => {
  const raw = route.query.issueType
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v : ''
})
const issueDetail = computed(() => {
  const raw = route.query.issueDetail
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v : ''
})
const fromCreate = computed(() => {
  const raw = route.query.fromCreate
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === '1' || v === 'true'
})

const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)
const loadError = ref('')
const accessDenied = ref(false)

const baseline = ref('')
const baselineHash = ref('')
const fileExists = ref(true)
const relativePath = ref('')
const spaceCode = ref('')
const resolvedSpaceId = ref<string | undefined>()
const content = ref('')
const changeLog = ref('')

const mainTab = ref<'write' | 'preview' | 'diff'>('write')
const contentHtml = shallowRef('')

const llmAvailable = ref(false)
const aiPanelOpen = ref(false)
const aiInstruction = ref('')
const aiGenerating = ref(false)
const aiNotes = ref('')
const aiSuggested = ref('')
const aiMeta = ref<{ provider?: string; model?: string } | null>(null)
const aiPreviewRef = ref<HTMLElement | null>(null)
type AiPreset = 'govern' | 'fixLinks' | 'custom'
const aiPreset = ref<AiPreset>('custom')

const lintPreviewItems = ref<KbWikiLintPreviewItem[]>([])
const lintChecking = ref(false)

const enrichPanelOpen = ref(false)
const enriching = ref(false)
const enrichPatch = ref('')
const enrichReason = ref('')
const enrichRawPaths = ref('')
const enrichBatchNo = ref('')
const enrichTopic = ref('')
const enrichGovernance = ref(true)
const enrichUpdateMeta = ref(true)
const enrichSyncAfter = ref(false)
const enrichPreview = ref('')
const enrichPreviewRows = computed<DiffRow[]>(() => {
  if (!enrichPreview.value) return []
  return diffLines(baseline.value, enrichPreview.value)
})

const canSync = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))
const sidePanelOpen = computed(() => aiPanelOpen.value || enrichPanelOpen.value)

const tabOptions = computed(() => [
  { value: 'write', label: t('knowledge.wikiEdit.tabWrite') },
  { value: 'preview', label: t('knowledge.wikiEdit.tabPreview') },
  { value: 'diff', label: t('knowledge.wikiEdit.tabDiff') },
])

const aiPresetOptions = computed(() => [
  { value: 'govern', label: t('knowledge.wikiEdit.aiPresetGovern') },
  { value: 'fixLinks', label: t('knowledge.wikiEdit.aiPresetFixLinks') },
  { value: 'custom', label: t('knowledge.wikiEdit.aiPresetCustom') },
])

const dirty = computed(() => content.value !== baseline.value)

const diffRows = computed<DiffRow[]>(() => {
  if (!dirty.value) return []
  return diffLines(baseline.value, content.value)
})
const diffStat = computed(() => {
  let added = 0
  let removed = 0
  for (const r of diffRows.value) {
    if (r.type === 'add') added += 1
    else if (r.type === 'del') removed += 1
  }
  return { added, removed }
})

const canEditSpace = computed(() => {
  const sid = querySpaceId.value ?? resolvedSpaceId.value
  if (sid) {
    const space = spaces.value.find((s) => toEntityId(s.id) === sid)
    return space?.canEdit === true
  }
  const def = spaces.value.find((s) => s.spaceCode === 'enterprise-kb')
  return def ? def.canEdit === true : true
})

const fromLintIssue = computed(() => Boolean(issueId.value))

watch(
  () => mainTab.value === 'preview' && content.value,
  (active) => {
    if (active) contentHtml.value = renderMarkdown(content.value)
  },
)
watch(content, () => {
  if (mainTab.value === 'preview') contentHtml.value = renderMarkdown(content.value)
})

watch(issueDetail, (detail) => {
  if (detail && !aiInstruction.value) {
    aiInstruction.value = t('knowledge.wikiEdit.aiDefaultFromIssue', { detail })
  }
}, { immediate: true })

async function loadLlmConfig() {
  try {
    const res = await getKbLlmConfigApi()
    llmAvailable.value = res.code === API_SUCCESS_CODE && res.data?.available === true
  } catch {
    llmAvailable.value = false
  }
}

async function load() {
  if (!slug.value) {
    loadError.value = t('knowledge.wikiEdit.noSlug')
    return
  }
  loading.value = true
  loadError.value = ''
  accessDenied.value = false
  lintPreviewItems.value = []
  try {
    const res = await getKbWikiPageApi(slug.value, querySpaceId.value)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      const msg = res.msg || t('knowledge.wikiEdit.loadFailed')
      if (msg.includes('无权') || msg.includes('权限')) accessDenied.value = true
      loadError.value = msg
      return
    }
    baseline.value = res.data.content ?? ''
    baselineHash.value = res.data.contentHash ?? ''
    fileExists.value = res.data.exists
    relativePath.value = res.data.relativePath ?? ''
    spaceCode.value = res.data.spaceCode ?? ''
    resolvedSpaceId.value = toEntityId(res.data.spaceId) ?? querySpaceId.value

    content.value = res.data.content ?? ''
    if (!res.data.exists) {
      const sid = querySpaceId.value ?? resolvedSpaceId.value ?? ''
      const draft = sid ? popWikiDraft(sid, slug.value) : null
      if (draft) {
        content.value = draft
        baseline.value = ''
        baselineHash.value = ''
      }
    }
    if (mainTab.value === 'preview') contentHtml.value = renderMarkdown(content.value)
    if (fromLintIssue.value) aiPanelOpen.value = true
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : t('knowledge.wikiEdit.loadFailed')
  } finally {
    loading.value = false
  }
}

async function runLintPreview(): Promise<KbWikiLintPreviewItem[]> {
  lintChecking.value = true
  try {
    const res = await previewKbWikiLintApi({
      slug: slug.value,
      spaceId: querySpaceId.value ?? resolvedSpaceId.value,
      content: content.value,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      return []
    }
    lintPreviewItems.value = res.data.issues ?? []
    return lintPreviewItems.value
  } finally {
    lintChecking.value = false
  }
}

async function confirmLintIfNeeded(force = false): Promise<boolean> {
  if (force) return true
  const issues = await runLintPreview()
  if (!issues.length) return true
  const summary = issues.slice(0, 5).map((it) => `• ${it.message}`).join('\n')
  const more = issues.length > 5 ? `\n…${t('knowledge.wikiEdit.lintMore', { count: issues.length - 5 })}` : ''
  return confirm({
    title: t('knowledge.wikiEdit.lintConfirmTitle'),
    message: `${t('knowledge.wikiEdit.lintConfirmMessage', { count: issues.length })}\n\n${summary}${more}`,
    confirmText: t('knowledge.wikiEdit.lintConfirmOk'),
    cancelText: t('confirm.cancel'),
  })
}

async function persistWiki(): Promise<boolean> {
  const res = await saveKbWikiPageApi({
    slug: slug.value,
    spaceId: querySpaceId.value ?? resolvedSpaceId.value,
    content: content.value,
    changeLog: changeLog.value.trim() || undefined,
    baselineHash: baselineHash.value || undefined,
  })
  if (res.code !== API_SUCCESS_CODE || !res.data) {
    throw new Error(res.msg || t('knowledge.wikiEdit.saveFailed'))
  }
  const wasNew = !fileExists.value
  const wasCreated = res.data.created === true || wasNew
  baseline.value = content.value
  baselineHash.value = res.data.contentHash ?? ''
  fileExists.value = true
  changeLog.value = ''
  lintPreviewItems.value = []
  return wasCreated
}

async function maybeMarkIssueFixed() {
  if (!issueId.value) return
  const ok = await confirm({
    title: t('knowledge.wikiEdit.markFixedTitle'),
    message: t('knowledge.wikiEdit.markFixedMessage'),
    confirmText: t('knowledge.wikiEdit.markFixedOk'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  const res = await updateKbLintIssueApi(issueId.value, 2)
  if (res.code !== API_SUCCESS_CODE) {
    showToast('error', res.msg || t('knowledge.lint.updateFailed'))
    return
  }
  showToast('success', t('knowledge.lint.updateOk'))
}

function instructionForPreset(preset: AiPreset): string {
  if (preset === 'govern') return t('knowledge.wikiEdit.governAiInstruction')
  if (preset === 'fixLinks') return t('knowledge.wikiEdit.aiPresetFixLinksInstruction')
  return ''
}

function defaultEnrichBatchNo() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `WEB-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}

function toggleAiPanel() {
  aiPanelOpen.value = !aiPanelOpen.value
  if (aiPanelOpen.value) enrichPanelOpen.value = false
}

function toggleEnrichPanel() {
  enrichPanelOpen.value = !enrichPanelOpen.value
  if (enrichPanelOpen.value) {
    aiPanelOpen.value = false
    if (!enrichBatchNo.value) enrichBatchNo.value = defaultEnrichBatchNo()
    if (!enrichTopic.value) enrichTopic.value = slug.value
  }
}

function openAiGovernance() {
  aiPanelOpen.value = true
  enrichPanelOpen.value = false
  aiPreset.value = 'govern'
}

function parseRawPathLines(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function runEnrich(dryRun: boolean) {
  if (!slug.value || enriching.value || !canEditSpace.value) return
  const patch = enrichPatch.value.trim()
  const rawPaths = parseRawPathLines(enrichRawPaths.value)
  if (!patch && rawPaths.length === 0) {
    showToast('error', t('knowledge.wikiEdit.enrichNeedInput'))
    return
  }
  if (!fileExists.value && !dryRun) {
    showToast('error', t('knowledge.wikiEdit.enrichNeedSavedPage'))
    return
  }
  if (dirty.value) {
    const ok = await confirm({
      title: t('knowledge.wikiEdit.enrichDirtyTitle'),
      message: t('knowledge.wikiEdit.enrichDirtyMessage'),
      confirmText: t('knowledge.wikiEdit.enrichDirtySave'),
      cancelText: t('confirm.cancel'),
    })
    if (!ok) return
    await persistWiki()
  }

  enriching.value = true
  try {
    const res = await enrichKbWikiApi({
      spaceId: querySpaceId.value ?? resolvedSpaceId.value,
      slug: slug.value,
      patch: patch || undefined,
      reason: enrichReason.value.trim() || undefined,
      rawPaths: rawPaths.length ? rawPaths : undefined,
      batchNo: enrichBatchNo.value.trim() || defaultEnrichBatchNo(),
      topic: enrichTopic.value.trim() || slug.value,
      updateMeta: enrichUpdateMeta.value,
      appendLog: enrichGovernance.value,
      appendIndex: enrichGovernance.value,
      appendEdges: enrichGovernance.value,
      dryRun,
      sync: !dryRun && enrichSyncAfter.value && canSync.value,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.wikiEdit.enrichFailed'))
    }
    const item = res.data.items?.[0]
    if (item?.error) {
      throw new Error(item.error)
    }
    if (dryRun) {
      enrichPreview.value = item?.mergedPreview ?? item?.patch ?? ''
      if (!enrichPreview.value) {
        throw new Error(t('knowledge.wikiEdit.enrichEmptyPreview'))
      }
      showToast('success', t('knowledge.wikiEdit.enrichPreviewOk'))
      return
    }
    enrichPreview.value = ''
    await load()
    const stats = formatEnrichStats(res.data)
    showToast('success', t('knowledge.wikiEdit.enrichApplyOk', { stats }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiEdit.enrichFailed'))
  } finally {
    enriching.value = false
  }
}

function formatEnrichStats(data: KbWikiEnrichResult): string {
  const parts: string[] = []
  if (data.logAppended) parts.push('log')
  if (data.indexUpdated) parts.push('index')
  if (data.edgesAppended && data.edgesAppended > 0) parts.push(`edges×${data.edgesAppended}`)
  if (data.syncTriggered) parts.push('sync')
  return parts.length ? parts.join(', ') : '—'
}

watch(aiPreset, (preset) => {
  if (preset !== 'custom') {
    aiInstruction.value = instructionForPreset(preset)
  }
})

async function maybePromptGovernance(wasCreated: boolean) {
  if (!wasCreated && !fromCreate.value) return
  const wantAi = await confirm({
    title: t('knowledge.wikiEdit.governTitle'),
    message: t('knowledge.wikiEdit.governMessage'),
    confirmText: t('knowledge.wikiEdit.governAi'),
    cancelText: t('knowledge.wikiEdit.governLater'),
    danger: false,
    warm: true,
  })
  if (fromCreate.value) {
    const q = { ...route.query }
    delete q.fromCreate
    void router.replace({ query: q })
  }
  if (!wantAi) return
  openAiGovernance()
}

async function save(options: { sync?: boolean; skipLintConfirm?: boolean } = {}) {
  if (!slug.value || saving.value || syncing.value) return
  if (!content.value.trim()) {
    showToast('error', t('knowledge.wikiEdit.emptyContent'))
    return
  }
  if (!dirty.value && !options.sync) return

  const lintOk = dirty.value ? await confirmLintIfNeeded(options.skipLintConfirm) : true
  if (!lintOk) return

  saving.value = true
  try {
    if (dirty.value) {
      const wasCreated = await persistWiki()
      showToast('success', t('knowledge.wikiEdit.saveOk'))
      await maybeMarkIssueFixed()
      await maybePromptGovernance(wasCreated)
    }
    if (options.sync) {
      await doSync()
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiEdit.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function doSync() {
  if (!canSync.value) {
    showToast('error', t('knowledge.wikiEdit.syncNoPerm'))
    return
  }
  syncing.value = true
  try {
    const res = await triggerKbSyncApi({
      spaceId: querySpaceId.value ?? resolvedSpaceId.value,
      spaceCode: spaceCode.value || undefined,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data?.success) {
      throw new Error(res.msg || res.data?.outputTail || t('knowledge.sync.triggerFailed'))
    }
    showToast('success', t('knowledge.wikiEdit.syncOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiEdit.syncFailed'))
  } finally {
    syncing.value = false
  }
}

async function saveAndSync() {
  await save({ sync: true })
}

function parseAiSuggested(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  const raw = d.suggestedContent ?? d.suggested_content ?? d.content
  return typeof raw === 'string' ? raw.trim() : ''
}

async function generateAi() {
  if (!llmAvailable.value || aiGenerating.value || !aiInstruction.value.trim()) return
  aiGenerating.value = true
  aiNotes.value = ''
  aiSuggested.value = ''
  aiMeta.value = null
  try {
    const res = await aiReviseKbWikiApi({
      slug: slug.value,
      spaceId: querySpaceId.value ?? resolvedSpaceId.value,
      instruction: aiInstruction.value.trim(),
      baselineContent: content.value,
      issueContext: issueType.value || issueDetail.value
        ? { issueType: issueType.value || undefined, detail: issueDetail.value || undefined }
        : undefined,
    })
    if (res.code !== API_SUCCESS_CODE) {
      throw new Error(res.msg || t('knowledge.wikiEdit.aiFailed'))
    }
    const suggested = parseAiSuggested(res.data)
    if (!suggested) {
      throw new Error(t('knowledge.wikiEdit.aiEmptyResult'))
    }
    aiSuggested.value = suggested
    if (res.data && typeof res.data === 'object') {
      const d = res.data as Record<string, unknown>
      aiNotes.value = typeof d.notes === 'string' ? d.notes : ''
      aiMeta.value = {
        provider: typeof d.provider === 'string' ? d.provider : undefined,
        model: typeof d.model === 'string' ? d.model : undefined,
      }
    }
    showToast('success', t('knowledge.wikiEdit.aiGenerateOk'))
    await nextTick()
    aiPreviewRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.wikiEdit.aiFailed'))
  } finally {
    aiGenerating.value = false
  }
}

function applyAiSuggestion() {
  if (!aiSuggested.value) return
  content.value = aiSuggested.value
  mainTab.value = 'diff'
  showToast('success', t('knowledge.wikiEdit.aiApplied'))
}

function openInBrowse() {
  const query: Record<string, string> = { slug: slug.value }
  const sid = querySpaceId.value ?? resolvedSpaceId.value
  if (sid) query.spaceId = sid
  void router.push({ path: '/knowledge/browse', query })
}

function goBack() {
  if (fromLintIssue.value) {
    void router.push({ path: '/knowledge/lint' })
    return
  }
  if (window.history.length > 1) router.back()
  else openInBrowse()
}

onMounted(async () => {
  await ensureSpacesLoaded()
  await loadLlmConfig()
  await load()
})

watch(slug, () => {
  void load()
})
</script>

<template>
  <div class="page-stack">
    <KbAccessDenied
      v-if="accessDenied"
      :title="t('knowledge.accessDenied.title')"
      :message="loadError"
    />

    <div v-else class="card flex min-h-[calc(100vh-9rem)] flex-col p-5">
      <header class="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4 dark:border-white/5">
        <button type="button" class="btn-ghost shrink-0 text-sm" @click="goBack">
          <ArrowLeft class="h-4 w-4" /> {{ fromLintIssue ? t('knowledge.wikiEdit.backLint') : t('knowledge.wikiEdit.back') }}
        </button>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">
              {{ t('knowledge.wikiEdit.pageTitle') }}
            </h2>
            <span v-if="spaceCode" class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">{{ spaceCode }}</span>
            <span v-if="fromCreate" class="badge bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              {{ t('knowledge.wikiEdit.fromCreate') }}
            </span>
            <span v-if="fromLintIssue" class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {{ t('knowledge.wikiEdit.fromLint') }}
            </span>
            <span v-if="!fileExists" class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {{ t('knowledge.wikiEdit.newFile') }}
            </span>
            <span v-if="dirty" class="badge bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              {{ t('knowledge.wikiEdit.unsaved') }}
            </span>
          </div>
          <p class="mt-1 truncate font-mono text-xs text-gray-400">{{ relativePath || slug }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn-ghost shrink-0 text-sm"
            :class="enrichPanelOpen && 'ring-1 ring-violet-300 dark:ring-violet-500/40'"
            :disabled="!canEditSpace || !fileExists"
            :title="fileExists ? t('knowledge.wikiEdit.enrichToggle') : t('knowledge.wikiEdit.enrichNeedSavedPage')"
            @click="toggleEnrichPanel"
          >
            <GitMerge class="h-4 w-4" /> {{ t('knowledge.wikiEdit.enrichGovern') }}
          </button>
          <button
            type="button"
            class="btn-ghost shrink-0 text-sm"
            :class="aiPanelOpen && 'ring-1 ring-brand-300 dark:ring-brand-500/40'"
            :disabled="!llmAvailable"
            :title="llmAvailable ? t('knowledge.wikiEdit.aiToggle') : t('knowledge.wikiEdit.aiDisabled')"
            @click="toggleAiPanel"
          >
            <Sparkles class="h-4 w-4" /> {{ t('knowledge.wikiEdit.aiAssist') }}
          </button>
          <button type="button" class="btn-ghost shrink-0 text-sm" @click="openInBrowse">
            <ExternalLink class="h-4 w-4" /> {{ t('knowledge.wikiEdit.openInBrowse') }}
          </button>
          <button
            type="button"
            class="btn-ghost shrink-0 text-sm"
            :disabled="saving || syncing || loading || !canEditSpace || !dirty"
            @click="save()"
          >
            <Loader2 v-if="saving && !syncing" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ t('knowledge.wikiEdit.save') }}
          </button>
          <button
            type="button"
            class="btn-primary shrink-0 text-sm"
            :disabled="saving || syncing || loading || !canEditSpace || (!dirty && !canSync)"
            @click="saveAndSync"
          >
            <Loader2 v-if="saving || syncing" class="h-4 w-4 animate-spin" />
            <Upload v-else class="h-4 w-4" />
            {{ t('knowledge.wikiEdit.saveAndSync') }}
          </button>
        </div>
      </header>

      <div
        v-if="fromLintIssue && issueDetail"
        class="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <span class="font-medium">{{ issueType || 'issue' }}:</span> {{ issueDetail }}
      </div>

      <p v-if="!canEditSpace && !loading" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        {{ t('knowledge.wikiEdit.readOnlyHint') }}
      </p>

      <div v-if="loading" class="flex flex-1 items-center justify-center p-8 text-sm text-gray-400">
        {{ t('common.loading') }}
      </div>
      <p v-else-if="loadError" class="flex flex-1 items-center justify-center p-8 text-sm text-rose-500">
        {{ loadError }}
      </p>

      <div v-else class="mt-4 flex min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:items-stretch">
        <div
          class="flex min-h-0 min-w-0 flex-col"
          :class="sidePanelOpen ? 'flex-1 xl:max-w-[58%]' : 'flex-1'"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <SegmentControl v-model="mainTab" :options="tabOptions" />
            <div class="flex items-center gap-3 text-xs text-gray-400">
              <span v-if="lintChecking">{{ t('knowledge.wikiEdit.lintChecking') }}</span>
              <span v-else-if="lintPreviewItems.length" class="text-amber-600 dark:text-amber-400">
                {{ t('knowledge.wikiEdit.lintIssuesFound', { count: lintPreviewItems.length }) }}
              </span>
              <span v-if="dirty">
                <span class="text-emerald-600 dark:text-emerald-400">+{{ diffStat.added }}</span>
                <span class="mx-1 text-rose-500">-{{ diffStat.removed }}</span>
              </span>
            </div>
          </div>

          <textarea
            v-if="mainTab === 'write'"
            v-model="content"
            class="field-input mt-3 min-h-[380px] flex-1 resize-y font-mono text-sm leading-relaxed"
            :placeholder="t('knowledge.wikiEdit.contentPlaceholder')"
            spellcheck="false"
          />

          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-else-if="mainTab === 'preview'"
            class="kb-markdown mt-3 min-h-[380px] flex-1 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]"
            v-html="contentHtml"
          />

          <div
            v-else
            class="mt-3 min-h-[380px] flex-1 overflow-auto rounded-lg border border-gray-100 bg-gray-50/50 font-mono text-xs leading-relaxed dark:border-white/5 dark:bg-white/[0.02]"
          >
            <p v-if="!dirty" class="p-4 text-gray-400">{{ t('knowledge.wikiEdit.noChange') }}</p>
            <table v-else class="w-full border-collapse">
              <tbody>
                <tr
                  v-for="(row, i) in diffRows"
                  :key="i"
                  :class="{
                    'bg-emerald-50 dark:bg-emerald-500/10': row.type === 'add',
                    'bg-rose-50 dark:bg-rose-500/10': row.type === 'del',
                  }"
                >
                  <td class="select-none border-r border-gray-100 px-2 text-right align-top text-gray-300 dark:border-white/5">
                    {{ row.type === 'add' ? '' : row.oldNo }}
                  </td>
                  <td class="select-none border-r border-gray-100 px-2 text-right align-top text-gray-300 dark:border-white/5">
                    {{ row.type === 'del' ? '' : row.newNo }}
                  </td>
                  <td
                    class="select-none px-2 align-top"
                    :class="{
                      'text-emerald-600 dark:text-emerald-400': row.type === 'add',
                      'text-rose-500': row.type === 'del',
                      'text-gray-300': row.type === 'ctx',
                    }"
                  >
                    {{ row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' ' }}
                  </td>
                  <td class="whitespace-pre-wrap break-all px-2 align-top text-gray-700 dark:text-gray-200">{{ row.text }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <label class="mt-3 flex flex-col gap-1">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.changeLog') }}</span>
            <input
              v-model="changeLog"
              type="text"
              class="field-input"
              :placeholder="t('knowledge.wikiEdit.changeLogPlaceholder')"
            />
          </label>
        </div>

        <!-- AI 协助面板（含单篇治理预设） -->
        <aside
          v-if="aiPanelOpen"
          class="relative flex min-h-[540px] w-full min-w-0 flex-col rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02] xl:min-w-[22rem] xl:max-w-[36rem] xl:flex-[0_0_42%]"
        >
          <div
            v-if="aiGenerating"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/85 px-4 text-center backdrop-blur-[2px] dark:bg-gray-900/85"
          >
            <Loader2 class="h-6 w-6 animate-spin text-brand-500" />
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.wikiEdit.aiGenerating') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.aiGeneratingHint') }}</p>
          </div>

          <h3 class="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Sparkles class="h-4 w-4 text-brand-500" /> {{ t('knowledge.wikiEdit.aiPanelTitle') }}
          </h3>
          <p v-if="!llmAvailable" class="mb-3 text-xs text-gray-400">{{ t('knowledge.wikiEdit.aiDisabled') }}</p>
          <template v-else>
            <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.aiPanelIntro') }}</p>
            <SegmentControl v-model="aiPreset" :options="aiPresetOptions" />
          </template>

          <label class="mt-3 shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.aiInstructionLabel') }}</label>
          <textarea
            v-model="aiInstruction"
            rows="5"
            class="field-input mt-1 max-h-40 min-h-[7.5rem] shrink-0 resize-y text-sm leading-relaxed"
            :placeholder="t('knowledge.wikiEdit.aiInstructionPlaceholder')"
            :disabled="!llmAvailable || aiGenerating"
            @input="aiPreset = 'custom'"
          />

          <div class="mt-3 flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              class="btn-primary text-sm"
              :disabled="!llmAvailable || aiGenerating || !aiInstruction.trim()"
              @click="generateAi"
            >
              <Loader2 v-if="aiGenerating" class="h-4 w-4 animate-spin" />
              {{ aiGenerating ? t('knowledge.wikiEdit.aiGenerating') : t('knowledge.wikiEdit.aiGenerate') }}
            </button>
            <button
              type="button"
              class="text-sm"
              :class="aiSuggested ? 'btn-primary' : 'btn-ghost'"
              :disabled="!aiSuggested || aiGenerating"
              @click="applyAiSuggestion"
            >
              {{ t('knowledge.wikiEdit.aiApply') }}
            </button>
          </div>

          <div
            ref="aiPreviewRef"
            class="mt-3 flex min-h-0 flex-1 flex-col"
          >
            <div class="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('knowledge.wikiEdit.aiPreviewTitle') }}</span>
              <span v-if="aiSuggested" class="text-xs text-gray-400">{{ t('knowledge.wikiEdit.aiPreviewChars', { count: aiSuggested.length }) }}</span>
            </div>
            <textarea
              v-if="aiSuggested"
              :value="aiSuggested"
              readonly
              class="field-input min-h-[min(48vh,28rem)] flex-1 resize-y font-mono text-xs leading-relaxed"
              spellcheck="false"
            />
            <div
              v-else
              class="flex min-h-[min(48vh,28rem)] flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white/60 px-4 text-center text-xs leading-relaxed text-gray-400 dark:border-white/10 dark:bg-white/[0.02]"
            >
              {{ t('knowledge.wikiEdit.aiPreviewEmpty') }}
            </div>
            <p
              v-if="aiSuggested && (aiMeta?.provider || aiMeta?.model)"
              class="mt-1.5 shrink-0 text-[11px] text-gray-400"
            >
              {{ t('knowledge.wikiEdit.aiModelInfo', { provider: aiMeta?.provider ?? '—', model: aiMeta?.model ?? '—' }) }}
            </p>
          </div>

          <p v-if="aiNotes" class="mt-2 shrink-0 rounded-md bg-gray-100/80 px-2 py-1.5 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
            {{ aiNotes }}
          </p>
          <p class="mt-2 shrink-0 text-xs text-gray-400">{{ t('knowledge.wikiEdit.aiHint') }}</p>
        </aside>

        <!-- Enrich 治理面板 -->
        <aside
          v-if="enrichPanelOpen"
          class="relative flex min-h-[540px] w-full min-w-0 flex-col rounded-lg border border-violet-100 bg-violet-50/30 p-4 dark:border-violet-500/20 dark:bg-violet-500/5 xl:min-w-[22rem] xl:max-w-[36rem] xl:flex-[0_0_42%]"
        >
          <div
            v-if="enriching"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/85 px-4 text-center backdrop-blur-[2px] dark:bg-gray-900/85"
          >
            <Loader2 class="h-6 w-6 animate-spin text-violet-500" />
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.wikiEdit.enrichRunning') }}</p>
          </div>

          <h3 class="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <GitMerge class="h-4 w-4 text-violet-500" /> {{ t('knowledge.wikiEdit.enrichPanelTitle') }}
          </h3>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.enrichPanelIntro') }}</p>

          <label class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.enrichPatchLabel') }}</label>
          <textarea
            v-model="enrichPatch"
            rows="6"
            class="field-input mt-1 min-h-[8rem] resize-y font-mono text-xs leading-relaxed"
            :placeholder="t('knowledge.wikiEdit.enrichPatchPlaceholder')"
            :disabled="enriching"
          />

          <label class="mt-3 text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.enrichRawLabel') }}</label>
          <textarea
            v-model="enrichRawPaths"
            rows="2"
            class="field-input mt-1 resize-y text-xs leading-relaxed"
            :placeholder="t('knowledge.wikiEdit.enrichRawPlaceholder')"
            :disabled="enriching"
          />

          <label class="mt-3 text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.enrichReasonLabel') }}</label>
          <input
            v-model="enrichReason"
            type="text"
            class="field-input mt-1 text-sm"
            :placeholder="t('knowledge.wikiEdit.enrichReasonPlaceholder')"
            :disabled="enriching"
          />

          <div class="mt-3 grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.enrichBatchNo') }}</span>
              <input v-model="enrichBatchNo" type="text" class="field-input text-xs" :disabled="enriching" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.wikiEdit.enrichTopic') }}</span>
              <input v-model="enrichTopic" type="text" class="field-input text-xs" :disabled="enriching" />
            </label>
          </div>

          <div class="mt-3 flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-300">
            <label class="flex cursor-pointer items-center gap-2">
              <input v-model="enrichGovernance" type="checkbox" class="rounded" :disabled="enriching" />
              {{ t('knowledge.wikiEdit.enrichGovernance') }}
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <input v-model="enrichUpdateMeta" type="checkbox" class="rounded" :disabled="enriching" />
              {{ t('knowledge.wikiEdit.enrichUpdateMeta') }}
            </label>
            <label v-if="canSync" class="flex cursor-pointer items-center gap-2">
              <input v-model="enrichSyncAfter" type="checkbox" class="rounded" :disabled="enriching" />
              {{ t('knowledge.wikiEdit.enrichSyncAfter') }}
            </label>
          </div>

          <div class="mt-3 flex shrink-0 flex-wrap gap-2">
            <button type="button" class="btn-ghost text-sm" :disabled="enriching" @click="runEnrich(true)">
              {{ t('knowledge.wikiEdit.enrichPreview') }}
            </button>
            <button type="button" class="btn-primary text-sm" :disabled="enriching" @click="runEnrich(false)">
              <Loader2 v-if="enriching" class="h-4 w-4 animate-spin" />
              {{ t('knowledge.wikiEdit.enrichApply') }}
            </button>
          </div>

          <div v-if="enrichPreview" class="mt-3 flex min-h-0 flex-1 flex-col">
            <span class="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
              {{ t('knowledge.wikiEdit.enrichPreviewTitle') }}
            </span>
            <div
              class="min-h-[12rem] flex-1 overflow-auto rounded-lg border border-gray-100 bg-white/80 font-mono text-xs leading-relaxed dark:border-white/10 dark:bg-white/[0.02]"
            >
              <table class="w-full border-collapse">
                <tbody>
                  <tr
                    v-for="(row, i) in enrichPreviewRows"
                    :key="i"
                    :class="{
                      'bg-emerald-50 dark:bg-emerald-500/10': row.type === 'add',
                      'bg-rose-50 dark:bg-rose-500/10': row.type === 'del',
                    }"
                  >
                    <td class="select-none px-2 align-top text-emerald-600 dark:text-emerald-400">
                      {{ row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' ' }}
                    </td>
                    <td class="whitespace-pre-wrap break-all px-2 align-top text-gray-700 dark:text-gray-200">{{ row.text }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p class="mt-2 shrink-0 text-xs text-gray-400">{{ t('knowledge.wikiEdit.enrichHint') }}</p>
        </aside>
      </div>

      <p v-if="!loading && !loadError" class="mt-3 text-xs text-gray-400">{{ t('knowledge.wikiEdit.syncHint') }}</p>
    </div>
  </div>
</template>
