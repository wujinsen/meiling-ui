<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Check, ChevronDown, ChevronRight, ClipboardCopy, Folder, Loader2, Play, RefreshCw, Sparkles, Upload, X } from 'lucide-vue-next'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import AppModal from '@/components/ui/AppModal.vue'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'
import {
  commitKbIngestApi,
  createKbIngestJobApi,
  createKbIngestJobFromTemplateApi,
  exportKbIngestAgentPromptApi,
  generateKbIngestDraftsApi,
  generateKbIngestPlanApi,
  getKbIngestJobApi,
  getKbIngestJobsApi,
  getKbIngestDraftsApi,
  getKbIngestRawTreeApi,
  getKbIngestRawCoverageApi,
  getKbIngestTemplatesApi,
  lintKbIngestApi,
  regenerateKbIngestDraftApi,
  saveKbIngestJobAsTemplateApi,
  setKbIngestDraftApprovalApi,
  updateKbIngestDraftApi,
  updateKbIngestPlanApi,
} from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { useActionPermissions } from '@/composables/useActionPermissions'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { toEntityId } from '@/utils/id'
import { diffLines, type DiffRow } from '@/utils/lineDiff'
import type {
  KbRawCoverage,
  KbRawCoverageFilter,
  KbRawCoverageItem,
  KbIngestDraft,
  KbIngestJob,
  KbIngestLint,
  KbIngestTemplate,
  KbRawTreeNode,
  KbAccessibleSpace,
} from '@/types/knowledge'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { spaces, ensureSpacesLoaded } = useKbSpace()
const { fullPermission } = useActionPermissions()

const ingestSpaceId = ref('')

const jobId = computed(() => {
  const raw = route.query.id
  const v = Array.isArray(raw) ? raw[0] : raw
  return toEntityId(typeof v === 'string' ? v : undefined) ?? undefined
})

/* ---------------- 列表 / 新建模式 ---------------- */
const jobs = ref<KbIngestJob[]>([])
const jobsLoading = ref(false)
const rawTree = ref<KbRawTreeNode[]>([])
const rawLoading = ref(false)
const rawCoverageFilter = ref<KbRawCoverageFilter>('all')
const rawCoverageByPath = ref<Map<string, KbRawCoverageItem>>(new Map())
const rawCoverageSummary = ref<KbRawCoverage['summary'] | null>(null)
const rawCoverageLoading = ref(false)
const selectedRaw = ref<Set<string>>(new Set())
const formTopic = ref('')
const formBatchNo = ref('')
const formExpectTypes = ref('')
const creating = ref(false)
const templates = ref<KbIngestTemplate[]>([])
const templatesLoading = ref(false)
const creatingFromTemplate = ref(false)
const saveTemplateOpen = ref(false)
const saveTemplateName = ref('')
const saveTemplateSaving = ref(false)

const defaultSpace = computed(() => spaces.value.find((s) => s.spaceCode === 'enterprise-kb') ?? spaces.value[0])

function spaceCanIngestEdit(space: KbAccessibleSpace | null | undefined): boolean {
  if (!space) return false
  if (fullPermission.value) return true
  if (space.canEdit === true) return true
  if (space.canAdmin === true) return true
  if (space.canEdit === undefined) return true
  return false
}

const editableSpaces = computed(() => spaces.value.filter((s) => spaceCanIngestEdit(s)))
const selectedSpace = computed(
  () => spaces.value.find((s) => toEntityId(s.id) === toEntityId(ingestSpaceId.value)) ?? null,
)
const selectedSpaceQueryId = computed(() => toEntityId(selectedSpace.value?.id))
const canEdit = computed(() => spaceCanIngestEdit(selectedSpace.value))

function initIngestSpace() {
  if (jobId.value || !spaces.value.length) return
  const cur = toEntityId(ingestSpaceId.value)
  const ok = editableSpaces.value.some((s) => toEntityId(s.id) === cur)
  const pick = editableSpaces.value[0] ?? defaultSpace.value
  const id = toEntityId(pick?.id)
  if (id && (!ok || !cur)) ingestSpaceId.value = id
}

function guardIngestEdit(): boolean {
  const ok = jobId.value ? jobCanEdit.value : canEdit.value
  if (ok) return true
  showToast('error', t('knowledge.ingest.readOnlyHint'))
  return false
}

const createDisabledReason = computed(() => {
  if (creating.value) return ''
  if (!editableSpaces.value.length) return t('knowledge.ingest.noEditableSpace')
  if (!canEdit.value) return t('knowledge.ingest.readOnlyHint')
  if (!formTopic.value.trim()) return t('knowledge.ingest.createNeedTopic')
  if (selectedRaw.value.size === 0) {
    if (rawFilterHidesAll.value) return t('knowledge.ingest.rawCoverageFilterEmpty')
    return t('knowledge.ingest.createNeedRaw')
  }
  return ''
})

const rawFileCount = computed(() => {
  let n = 0
  const walk = (nodes: KbRawTreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') n += 1
      else if (node.children?.length) walk(node.children)
    }
  }
  walk(rawTree.value)
  return n
})

const rawFilterHidesAll = computed(() => {
  if (rawCoverageFilter.value === 'all' || rawLoading.value || rawCoverageLoading.value) return false
  if (!rawFileCount.value) return false
  return !filteredRawFlatTree.value.some((item) => item.node.type === 'file')
})

type RawFlatNode = { node: KbRawTreeNode; depth: number; hasChildren: boolean }
const rawExpandedDirs = ref<Set<string>>(new Set())

function collectRawDirPaths(nodes: KbRawTreeNode[]): string[] {
  const paths: string[] = []
  const walk = (list: KbRawTreeNode[]) => {
    for (const n of list) {
      if (n.type === 'dir') {
        paths.push(n.path)
        if (n.children?.length) walk(n.children)
      }
    }
  }
  walk(nodes)
  return paths
}

const rawFlatTree = computed<RawFlatNode[]>(() => {
  const out: RawFlatNode[] = []
  const walk = (nodes: KbRawTreeNode[], depth: number) => {
    for (const n of nodes) {
      const hasChildren = n.type === 'dir' && Boolean(n.children?.length)
      out.push({ node: n, depth, hasChildren })
      if (hasChildren && rawExpandedDirs.value.has(n.path)) {
        walk(n.children!, depth + 1)
      }
    }
  }
  walk(rawTree.value, 0)
  return out
})

const rawCoverageFilterOptions = computed(() => [
  { value: 'open' as const, label: t('knowledge.ingest.rawCoverageOpen') },
  { value: 'cluster' as const, label: t('knowledge.ingest.rawCoverageCluster') },
  { value: 'covered' as const, label: t('knowledge.ingest.rawCoverageCovered') },
  { value: 'all' as const, label: t('knowledge.ingest.rawCoverageAll') },
])

function coverageForPath(path: string): KbRawCoverageItem | undefined {
  return rawCoverageByPath.value.get(path)
}

function pathMatchesCoverageFilter(path: string): boolean {
  if (rawCoverageFilter.value === 'all') return true
  const cov = coverageForPath(path)?.coverage ?? 'open'
  return cov === rawCoverageFilter.value
}

const visibleRawFilePaths = computed(() => {
  const set = new Set<string>()
  const walk = (nodes: KbRawTreeNode[]) => {
    for (const n of nodes) {
      if (n.type === 'file') {
        if (pathMatchesCoverageFilter(n.path)) set.add(n.path)
      } else if (n.children?.length) walk(n.children)
    }
  }
  walk(rawTree.value)
  return set
})

function dirHasVisibleFiles(dirPath: string): boolean {
  if (rawCoverageFilter.value === 'all') return true
  for (const p of visibleRawFilePaths.value) {
    if (p.startsWith(`${dirPath}/`)) return true
  }
  return false
}

const filteredRawFlatTree = computed<RawFlatNode[]>(() => {
  if (rawCoverageFilter.value === 'all') return rawFlatTree.value
  return rawFlatTree.value.filter((item) => {
    if (item.node.type === 'file') return pathMatchesCoverageFilter(item.node.path)
    return dirHasVisibleFiles(item.node.path)
  })
})

function rawCoverageBadgeClass(path: string): string {
  const cov = coverageForPath(path)?.coverage ?? 'open'
  if (cov === 'covered') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (cov === 'cluster') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
}

function rawCoverageBadgeLabel(path: string): string {
  const cov = coverageForPath(path)?.coverage ?? 'open'
  if (cov === 'covered') return t('knowledge.ingest.rawCoverageCovered')
  if (cov === 'cluster') return t('knowledge.ingest.rawCoverageCluster')
  return t('knowledge.ingest.rawCoverageOpen')
}

function rawCoverageTitle(path: string): string {
  const item = coverageForPath(path)
  if (!item?.wikiSlugs?.length) return rawCoverageBadgeLabel(path)
  return `${rawCoverageBadgeLabel(path)} → ${item.wikiSlugs.join(', ')}`
}

function isRawDirExpanded(path: string) {
  return rawExpandedDirs.value.has(path)
}

function toggleRawDir(path: string) {
  const next = new Set(rawExpandedDirs.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  rawExpandedDirs.value = next
}

function expandAllRawDirs() {
  rawExpandedDirs.value = new Set(collectRawDirPaths(rawTree.value))
}

function collapseAllRawDirs() {
  rawExpandedDirs.value = new Set()
}

function toggleRaw(path: string) {
  const next = new Set(selectedRaw.value)
  if (next.has(path)) next.delete(path)
  else {
    const item = coverageForPath(path)
    if (item?.coverage === 'covered') {
      showToast('success', t('knowledge.ingest.rawAlreadyCoveredHint'))
    }
    next.add(path)
  }
  selectedRaw.value = next
}

async function loadJobs() {
  jobsLoading.value = true
  try {
    const res = await getKbIngestJobsApi({
      spaceId: selectedSpaceQueryId.value,
      pageSize: 50,
    })
    if (res.code === API_SUCCESS_CODE && res.data) jobs.value = res.data.records ?? []
  } finally {
    jobsLoading.value = false
  }
}

async function loadRawTree() {
  rawLoading.value = true
  try {
    const res = await getKbIngestRawTreeApi()
    if (res.code === API_SUCCESS_CODE && res.data) rawTree.value = res.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.loadFailed'))
  } finally {
    rawLoading.value = false
  }
}

async function loadRawCoverage(refresh = false) {
  rawCoverageLoading.value = true
  try {
    const res = await getKbIngestRawCoverageApi({
      spaceId: selectedSpaceQueryId.value,
      filter: 'all',
      refresh,
    })
    if (res.code === API_SUCCESS_CODE && res.data) {
      const map = new Map<string, KbRawCoverageItem>()
      for (const item of res.data.items ?? []) map.set(item.path, item)
      rawCoverageByPath.value = map
      rawCoverageSummary.value = res.data.summary ?? null
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.rawCoverageLoadFailed'))
  } finally {
    rawCoverageLoading.value = false
  }
}

async function reloadRawSources() {
  await Promise.all([loadRawTree(), loadRawCoverage(true)])
}

async function loadTemplates() {
  templatesLoading.value = true
  try {
    const res = await getKbIngestTemplatesApi(selectedSpaceQueryId.value)
    if (res.code === API_SUCCESS_CODE && res.data) templates.value = res.data
  } finally {
    templatesLoading.value = false
  }
}

async function createJobFromTemplate(tpl: KbIngestTemplate) {
  if (!guardIngestEdit()) return
  if (creatingFromTemplate.value) return
  creatingFromTemplate.value = true
  try {
    const res = await createKbIngestJobFromTemplateApi(tpl.id, {
      batchNo: formBatchNo.value.trim() || undefined,
      topic: formTopic.value.trim() || undefined,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    void router.push({ path: '/knowledge/ingest', query: { id: String(res.data.id) } })
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    creatingFromTemplate.value = false
  }
}

function openSaveTemplateModal() {
  if (!guardIngestEdit()) return
  if (!jobId.value || !jobCanEdit.value) return
  saveTemplateName.value = job.value?.topic?.trim() ?? ''
  saveTemplateOpen.value = true
}

async function submitSaveTemplate() {
  const name = saveTemplateName.value.trim()
  if (!name) {
    showToast('error', t('knowledge.ingest.saveAsTemplateNameRequired'))
    return
  }
  if (!jobId.value || saveTemplateSaving.value) return
  saveTemplateSaving.value = true
  try {
    const res = await saveKbIngestJobAsTemplateApi(jobId.value, {
      name,
      includePlan: Boolean(job.value?.planVersion),
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    saveTemplateOpen.value = false
    showToast('success', t('knowledge.ingest.saveAsTemplateOk'))
    void loadTemplates()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    saveTemplateSaving.value = false
  }
}

async function createJob() {
  if (!guardIngestEdit()) return
  if (creating.value) return
  if (!formTopic.value.trim()) {
    showToast('error', t('knowledge.ingest.topic'))
    return
  }
  if (selectedRaw.value.size === 0) {
    showToast('error', t('knowledge.ingest.selected', { count: 0 }))
    return
  }
  creating.value = true
  try {
    const res = await createKbIngestJobApi({
      spaceId: selectedSpaceQueryId.value,
      topic: formTopic.value.trim(),
      batchNo: formBatchNo.value.trim() || undefined,
      expectTypes: formExpectTypes.value.trim() || undefined,
      rawPaths: Array.from(selectedRaw.value),
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    void router.push({ path: '/knowledge/ingest', query: { id: String(res.data.id) } })
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    creating.value = false
  }
}

/* ---------------- 批次详情模式 ---------------- */
const job = ref<KbIngestJob | null>(null)
const jobLoading = ref(false)
const jobLoadError = ref('')
const planText = ref('')
const planGenerating = ref(false)
const planSaving = ref(false)

const drafts = ref<KbIngestDraft[]>([])
const draftsGenerating = ref(false)
const activeSlug = ref('')
const draftTab = ref<'diff' | 'edit' | 'patch'>('diff')
const draftEditContent = ref('')
const draftPatchContent = ref('')
const draftSaving = ref(false)
const draftRegenerating = ref(false)

const lint = ref<KbIngestLint | null>(null)
const linting = ref(false)
const committing = ref(false)

const lastGenerateStats = ref<{ generated: number; skipped: number; failed: number; total: number } | null>(null)

const jobCanEdit = computed(() => {
  if (fullPermission.value) return true
  if (job.value?.canEdit === true) return true
  if (job.value?.canEdit === false) return false
  return canEdit.value
})
const isEnrichDraft = computed(() => activeDraft.value?.action === 'enrich')

const draftTabOptions = computed(() => {
  const opts = [
    { value: 'diff', label: t('knowledge.ingest.draftDiffDraft') + ' / ' + t('knowledge.ingest.draftDiffBaseline') },
    { value: 'edit', label: t('knowledge.ingest.saveDraft') },
  ]
  if (isEnrichDraft.value) {
    opts.push({ value: 'patch', label: t('knowledge.ingest.patchTab') })
  }
  return opts
})

const activeDraft = computed(() => drafts.value.find((d) => d.slug === activeSlug.value) ?? null)
const diffRows = computed<DiffRow[]>(() => {
  const d = activeDraft.value
  if (!d) return []
  return diffLines(d.baseline ?? '', d.draft ?? '')
})

const patchDiffRows = computed<DiffRow[]>(() => {
  const d = activeDraft.value
  if (!d?.patch) return []
  return diffLines('', d.patch)
})

const allApproved = computed(() => drafts.value.length > 0 && drafts.value.every((d) => d.approval !== 'draft'))
const approvedCount = computed(() => drafts.value.filter((d) => d.approval === 'approved').length)
const canCommit = computed(
  () => jobCanEdit.value && allApproved.value && approvedCount.value > 0 && lint.value?.commitReady === true,
)

const hasSavedPlan = computed(() => Boolean(job.value?.planVersion && job.value.planVersion > 0))

const planGenerateHint = computed(() => {
  if (planGenerating.value) return t('knowledge.ingest.planGenerating')
  if (!jobCanEdit.value) return t('knowledge.ingest.readOnlyHint')
  return null
})
const exportPromptHint = computed(() => {
  if (!hasSavedPlan.value) return t('knowledge.ingest.hintNeedSavedPlan')
  return null
})
const savePlanHint = computed(() => {
  if (planSaving.value) return t('knowledge.ingest.planSaving')
  if (!jobCanEdit.value) return t('knowledge.ingest.readOnlyHint')
  if (!planText.value.trim()) return t('knowledge.ingest.hintPlanEmpty')
  if (!planObj.value) return t('knowledge.ingest.planJsonInvalid')
  return null
})
const generateDraftsHint = computed(() => {
  if (draftsGenerating.value) return t('knowledge.ingest.draftsGenerating')
  if (!jobCanEdit.value) return t('knowledge.ingest.readOnlyHint')
  if (!hasSavedPlan.value) {
    if (planText.value.trim()) return t('knowledge.ingest.hintSavePlanBeforeDrafts')
    return t('knowledge.ingest.needPlanFirst')
  }
  return null
})
const resumeGenerateHint = computed(() => {
  const base = generateDraftsHint.value
  if (base) return base
  if (!drafts.value.length) return t('knowledge.ingest.hintNeedDraftsForResume')
  return null
})
const commitHint = computed(() => {
  if (committing.value) return t('knowledge.ingest.committing')
  if (!jobCanEdit.value) return t('knowledge.ingest.readOnlyHint')
  if (!allApproved.value) return t('knowledge.ingest.lintNeedApprove')
  if (!lint.value) return t('knowledge.ingest.lintNeedRun')
  if (!lint.value.commitReady) {
    if (lint.value.blockingCount) return t('knowledge.ingest.lintBlocked', { count: lint.value.blockingCount })
    return t('knowledge.ingest.lintNeedRun')
  }
  return null
})

function hintTitle(reason: string | null) {
  return reason ?? undefined
}

function statusLabel(s?: string) {
  const map: Record<string, string> = {
    created: t('knowledge.ingest.statusCreated'),
    planned: t('knowledge.ingest.statusPlanned'),
    reviewing: t('knowledge.ingest.statusReviewing'),
    generating: t('knowledge.ingest.statusGenerating'),
    committed: t('knowledge.ingest.statusCommitted'),
    cancelled: t('knowledge.ingest.statusCancelled'),
  }
  return s ? map[s] ?? s : ''
}

const planObj = computed(() => {
  try {
    return planText.value.trim() ? JSON.parse(planText.value) : null
  } catch {
    return null
  }
})
const conflicts = computed<string[]>(() => {
  const c = planObj.value?.conflicts
  return Array.isArray(c) ? c : []
})

async function loadJob() {
  if (!jobId.value) return
  jobLoading.value = true
  jobLoadError.value = ''
  try {
    const res = await getKbIngestJobApi(jobId.value)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.loadFailed'))
    job.value = res.data
    planText.value = res.data.planJson ? prettyJson(res.data.planJson) : ''
    await loadDrafts()
  } catch (e) {
    job.value = null
    jobLoadError.value = e instanceof Error ? e.message : t('knowledge.ingest.loadFailed')
    showToast('error', jobLoadError.value)
  } finally {
    jobLoading.value = false
  }
}

function prettyJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

async function generatePlan() {
  if (!guardIngestEdit()) return
  if (!jobId.value || planGenerating.value) return
  planGenerating.value = true
  try {
    const res = await generateKbIngestPlanApi(jobId.value)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    job.value = res.data
    planText.value = res.data.planJson ? prettyJson(res.data.planJson) : ''
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    planGenerating.value = false
  }
}

async function savePlan() {
  if (!guardIngestEdit()) return
  if (!jobId.value || planSaving.value) return
  if (!planObj.value) {
    showToast('error', t('knowledge.ingest.planJsonInvalid'))
    return
  }
  planSaving.value = true
  try {
    const res = await updateKbIngestPlanApi(jobId.value, { planJson: planText.value })
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    job.value = res.data
    showToast('success', t('knowledge.ingest.savePlan'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    planSaving.value = false
  }
}

async function exportPrompt() {
  if (!jobId.value) return
  try {
    const res = await exportKbIngestAgentPromptApi(jobId.value)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    await navigator.clipboard.writeText(res.data)
    showToast('success', t('knowledge.ingest.exportCopied'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  }
}

async function loadDrafts() {
  if (!jobId.value) return
  const res = await getKbIngestDraftsApi(jobId.value)
  if (res.code === API_SUCCESS_CODE && res.data) {
    drafts.value = res.data
    if (!activeSlug.value && drafts.value.length) selectDraft(drafts.value[0])
    syncActiveEdit()
  }
}

async function generateDrafts(resume = false) {
  if (!guardIngestEdit()) return
  if (!jobId.value || draftsGenerating.value) return
  if (!resume) {
    const ok = await confirm({
      title: t('knowledge.ingest.generateDrafts'),
      message: t('knowledge.ingest.regenerateAllDraftsConfirm'),
      confirmText: t('knowledge.ingest.generateDrafts'),
      cancelText: t('confirm.cancel'),
    })
    if (!ok) return
  }
  draftsGenerating.value = true
  try {
    const res = await generateKbIngestDraftsApi(jobId.value, resume)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    drafts.value = res.data.drafts ?? []
    lastGenerateStats.value = {
      generated: res.data.generated ?? 0,
      skipped: res.data.skipped ?? 0,
      failed: res.data.failed ?? 0,
      total: res.data.total ?? drafts.value.length,
    }
    lint.value = null
    if (drafts.value.length) selectDraft(drafts.value[0])
    await loadJob()
    showToast(
      lastGenerateStats.value.failed > 0 ? 'error' : 'success',
      t('knowledge.ingest.generateProgress', {
        generated: lastGenerateStats.value.generated,
        skipped: lastGenerateStats.value.skipped,
        total: lastGenerateStats.value.total,
      }) +
        (lastGenerateStats.value.failed > 0
          ? ' ' + t('knowledge.ingest.generateFailed', { failed: lastGenerateStats.value.failed })
          : ''),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    draftsGenerating.value = false
  }
}

function selectDraft(d: KbIngestDraft) {
  activeSlug.value = d.slug
  draftEditContent.value = d.draft ?? ''
  draftPatchContent.value = d.patch ?? ''
  if (d.action !== 'enrich' && draftTab.value === 'patch') draftTab.value = 'diff'
}
function syncActiveEdit() {
  const d = activeDraft.value
  if (d) {
    draftEditContent.value = d.draft ?? ''
    draftPatchContent.value = d.patch ?? ''
  }
}

async function saveDraft() {
  if (!guardIngestEdit()) return
  const d = activeDraft.value
  if (!jobId.value || !d || draftSaving.value) return
  draftSaving.value = true
  try {
    const payload = draftTab.value === 'patch' ? { patch: draftPatchContent.value } : { content: draftEditContent.value }
    const res = await updateKbIngestDraftApi(jobId.value, d.slug, payload)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    replaceDraft(res.data)
    draftEditContent.value = res.data.draft ?? ''
    draftPatchContent.value = res.data.patch ?? ''
    showToast('success', t('knowledge.ingest.saveDraft'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    draftSaving.value = false
  }
}

async function regenerateDraft() {
  if (!guardIngestEdit()) return
  const d = activeDraft.value
  if (!jobId.value || !d || draftRegenerating.value) return
  draftRegenerating.value = true
  try {
    const res = await regenerateKbIngestDraftApi(jobId.value, d.slug)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    replaceDraft(res.data)
    draftEditContent.value = res.data.draft ?? ''
    draftPatchContent.value = res.data.patch ?? ''
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    draftRegenerating.value = false
  }
}

async function setApproval(d: KbIngestDraft, approval: 'approved' | 'rejected' | 'draft') {
  if (!guardIngestEdit()) return
  if (!jobId.value) return
  try {
    const res = await setKbIngestDraftApprovalApi(jobId.value, d.slug, approval)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    replaceDraft(res.data)
    lint.value = null
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  }
}

function replaceDraft(updated: KbIngestDraft) {
  drafts.value = drafts.value.map((x) => (x.slug === updated.slug ? updated : x))
}

async function runLint() {
  if (!jobId.value || linting.value) return
  linting.value = true
  try {
    const res = await lintKbIngestApi(jobId.value)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    lint.value = res.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    linting.value = false
  }
}

async function commit(sync: boolean) {
  if (!guardIngestEdit()) return
  if (!jobId.value || committing.value) return
  if (!canCommit.value) {
    showToast('error', lint.value ? t('knowledge.ingest.lintNeedApprove') : t('knowledge.ingest.lintNeedRun'))
    return
  }
  const ok = await confirm({
    title: sync ? t('knowledge.ingest.commitAndSync') : t('knowledge.ingest.commit'),
    message: t('knowledge.ingest.commitSuccess', { created: approvedCount.value, updated: 0 }),
    confirmText: t('knowledge.ingest.commit'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  committing.value = true
  try {
    const res = await commitKbIngestApi(jobId.value, sync)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    showToast('success', t('knowledge.ingest.commitSuccess', { created: res.data.created, updated: res.data.updated }))
    if (res.data.syncTriggered) {
      if (res.data.syncResult?.success) showToast('success', t('knowledge.ingest.syncTriggered'))
      else showToast('error', res.data.syncResult?.outputTail || 'Sync')
    }
    await loadJob()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    committing.value = false
  }
}

function backToList() {
  void router.push({ path: '/knowledge/ingest' })
}

function approvalBadgeClass(approval: string) {
  if (approval === 'approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (approval === 'rejected') return 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
  return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
}
function approvalLabel(approval: string) {
  if (approval === 'approved') return t('knowledge.ingest.approved')
  if (approval === 'rejected') return t('knowledge.ingest.rejected')
  return t('knowledge.ingest.draftPending')
}

watch(rawTree, (tree) => {
  if (tree.length) expandAllRawDirs()
})

watch(jobId, (id) => {
  job.value = null
  drafts.value = []
  activeSlug.value = ''
  lint.value = null
  if (id) void loadJob()
  else {
    void loadJobs()
    void reloadRawSources()
    void loadTemplates()
  }
})

watch(selectedSpaceQueryId, () => {
  if (!jobId.value) {
    void loadJobs()
    void loadTemplates()
    void loadRawCoverage(true)
  }
})

watch(() => spaces.value.length, () => {
  initIngestSpace()
})

onMounted(async () => {
  await ensureSpacesLoaded()
  initIngestSpace()
  if (jobId.value) await loadJob()
  else {
    await loadJobs()
    await reloadRawSources()
    await loadTemplates()
  }
})
</script>

<template>
  <div class="page-stack">
    <!-- ===================== 列表 / 新建 ===================== -->
    <template v-if="!jobId">
      <div class="card p-5">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('knowledge.ingest.pageTitle') }}</h2>
          <KbSpaceDropdown v-model="ingestSpaceId" hide-all-option />
        </div>
        <p class="mt-1 text-xs text-gray-400">{{ t('knowledge.ingest.subtitle') }}</p>
        <p v-if="!editableSpaces.length" class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {{ t('knowledge.ingest.noEditableSpace') }}
        </p>
        <p v-else-if="!canEdit" class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {{ t('knowledge.ingest.readOnlyHint') }}
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card flex flex-col p-5">
          <h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.newBatch') }}</h3>
          <div class="grid gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.topic') }}</span>
              <input v-model="formTopic" type="text" class="field-input" :placeholder="t('knowledge.ingest.topicPlaceholder')" />
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.batchNo') }}</span>
                <input v-model="formBatchNo" type="text" class="field-input" :placeholder="t('knowledge.ingest.batchNoPlaceholder')" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.expectTypes') }}</span>
                <input v-model="formExpectTypes" type="text" class="field-input" :placeholder="t('knowledge.ingest.expectTypesPlaceholder')" />
              </label>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('knowledge.ingest.rawTree') }}</span>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-gray-400">{{ t('knowledge.ingest.selected', { count: selectedRaw.size }) }}</span>
              <button
                type="button"
                class="btn-ghost px-2 py-0.5 text-xs"
                :disabled="rawLoading || rawCoverageLoading"
                @click="reloadRawSources"
              >
                <RefreshCw class="inline h-3 w-3" :class="(rawLoading || rawCoverageLoading) && 'animate-spin'" />
                {{ t('knowledge.ingest.rawCoverageRefresh') }}
              </button>
              <button
                v-if="rawFlatTree.length"
                type="button"
                class="btn-ghost px-2 py-0.5 text-xs"
                @click="expandAllRawDirs"
              >
                {{ t('common.expandAll') }}
              </button>
              <button
                v-if="rawFlatTree.length"
                type="button"
                class="btn-ghost px-2 py-0.5 text-xs"
                @click="collapseAllRawDirs"
              >
                {{ t('common.collapseAll') }}
              </button>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <SegmentControl v-model="rawCoverageFilter" :options="rawCoverageFilterOptions" />
            <p v-if="rawCoverageSummary" class="text-xs text-gray-400">
              {{
                t('knowledge.ingest.rawCoverageSummary', {
                  open: rawCoverageSummary.open,
                  covered: rawCoverageSummary.covered,
                  cluster: rawCoverageSummary.cluster,
                  total: rawCoverageSummary.totalFiles,
                })
              }}
            </p>
          </div>
          <div class="mt-2 max-h-72 flex-1 overflow-auto rounded-lg border border-gray-100 p-2 dark:border-white/5">
            <p v-if="rawLoading || rawCoverageLoading" class="p-3 text-xs text-gray-400">{{ t('common.loading') }}</p>
            <p v-else-if="!filteredRawFlatTree.length" class="p-3 text-xs text-gray-400">{{ t('knowledge.ingest.rawTreeEmpty') }}</p>
            <template v-else>
              <div
                v-for="item in filteredRawFlatTree"
                :key="item.node.path"
                class="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-gray-50 dark:hover:bg-white/5"
                :class="item.node.type === 'file' ? 'no-tilt-drag cursor-pointer' : item.hasChildren ? 'no-tilt-drag cursor-pointer' : ''"
                :style="{ paddingLeft: `${item.depth * 14 + 6}px` }"
                @click="item.node.type === 'file' ? toggleRaw(item.node.path) : item.hasChildren && toggleRawDir(item.node.path)"
              >
                <template v-if="item.node.type === 'dir'">
                  <ChevronDown
                    v-if="item.hasChildren && isRawDirExpanded(item.node.path)"
                    class="h-3.5 w-3.5 shrink-0 text-gray-400"
                  />
                  <ChevronRight
                    v-else-if="item.hasChildren"
                    class="h-3.5 w-3.5 shrink-0 text-gray-400"
                  />
                  <span v-else class="inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <Folder class="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span class="truncate text-gray-500 dark:text-gray-400">{{ item.node.name }}</span>
                </template>
                <template v-else>
                  <span class="inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <input
                    type="checkbox"
                    class="pointer-events-none h-3.5 w-3.5 shrink-0"
                    :checked="selectedRaw.has(item.node.path)"
                    tabindex="-1"
                  />
                  <span
                    v-if="coverageForPath(item.node.path)"
                    class="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                    :class="rawCoverageBadgeClass(item.node.path)"
                    :title="rawCoverageTitle(item.node.path)"
                  >
                    {{ rawCoverageBadgeLabel(item.node.path) }}
                  </span>
                  <span class="truncate text-gray-700 dark:text-gray-200">{{ item.node.name }}</span>
                </template>
              </div>
            </template>
          </div>

          <button
            type="button"
            class="btn-primary mt-4 self-start text-sm"
            :disabled="Boolean(createDisabledReason)"
            :title="createDisabledReason || undefined"
            @click="createJob"
          >
            <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
            {{ creating ? t('knowledge.ingest.creating') : t('knowledge.ingest.create') }}
          </button>
          <p v-if="createDisabledReason" class="mt-2 text-xs text-amber-700 dark:text-amber-300">{{ createDisabledReason }}</p>
        </div>

        <!-- 历史批次 -->
        <div class="card flex flex-col p-5">
          <h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.history') }}</h3>
          <p v-if="jobsLoading" class="text-xs text-gray-400">{{ t('common.loading') }}</p>
          <p v-else-if="!jobs.length" class="text-xs text-gray-400">{{ t('knowledge.ingest.noJobs') }}</p>
          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="j in jobs"
              :key="String(j.id)"
              class="no-tilt-drag flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm hover:border-brand-200 hover:bg-brand-50/40 dark:border-white/5 dark:hover:bg-white/5"
              @click="router.push({ path: '/knowledge/ingest', query: { id: String(j.id) } })"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ j.topic }}</p>
                <p class="truncate text-xs text-gray-400">#{{ j.batchNo }} · {{ j.rawPaths?.length ?? 0 }} raw</p>
              </div>
              <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ statusLabel(j.status) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- 批次模板 -->
      <div class="card p-5">
        <h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.templates') }}</h3>
        <p v-if="templatesLoading" class="text-xs text-gray-400">{{ t('common.loading') }}</p>
        <p v-else-if="!templates.length" class="text-xs text-gray-400">{{ t('knowledge.ingest.templatesEmpty') }}</p>
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="tpl in templates"
            :key="String(tpl.id)"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-white/5"
          >
            <div class="min-w-0">
              <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ tpl.name }}</p>
              <p class="truncate text-xs text-gray-400">
                {{ tpl.topic }} · {{ tpl.rawPaths?.length ?? 0 }} raw
                <span v-if="tpl.hasPlan"> · plan</span>
              </p>
            </div>
            <button
              type="button"
              class="btn-ghost shrink-0 text-xs"
              :disabled="creatingFromTemplate || !canEdit"
              @click="createJobFromTemplate(tpl)"
            >
              <Loader2 v-if="creatingFromTemplate" class="h-3.5 w-3.5 animate-spin" />
              {{ t('knowledge.ingest.fromTemplate') }}
            </button>
          </li>
        </ul>
      </div>
    </template>

    <!-- ===================== 批次详情 ===================== -->
    <template v-else>
      <div v-if="jobLoading" class="card flex items-center justify-center p-12 text-sm text-gray-400">
        <Loader2 class="mr-2 h-5 w-5 animate-spin" /> {{ t('common.loading') }}
      </div>
      <div v-else-if="jobLoadError" class="card flex flex-col items-center gap-3 p-12 text-center">
        <p class="text-sm text-rose-500">{{ jobLoadError }}</p>
        <button type="button" class="btn-primary text-sm" @click="backToList">
          {{ t('knowledge.ingest.backToList') }}
        </button>
      </div>
      <template v-else>
      <div class="card p-5">
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="btn-ghost shrink-0 text-sm" @click="backToList">
            <ArrowLeft class="h-4 w-4" /> {{ t('knowledge.ingest.backToList') }}
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ job?.topic || t('knowledge.ingest.pageTitle') }}</h2>
              <span v-if="job" class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">#{{ job.batchNo }}</span>
              <span v-if="job" class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ statusLabel(job.status) }}</span>
              <span v-if="job?.spaceCode" class="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{{ job.spaceCode }}</span>
            </div>
          </div>
          <button
            v-if="jobCanEdit"
            type="button"
            class="btn-ghost shrink-0 text-sm"
            @click="openSaveTemplateModal"
          >
            {{ t('knowledge.ingest.saveAsTemplate') }}
          </button>
        </div>
        <p v-if="job && !jobCanEdit" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {{ t('knowledge.ingest.readOnlyHint') }}
        </p>
      </div>

      <!-- ① Plan -->
      <div class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.planSection') }}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="btn-ghost text-sm"
              :disabled="planGenerating || !jobCanEdit"
              :title="hintTitle(planGenerateHint)"
              @click="generatePlan"
            >
              <Loader2 v-if="planGenerating" class="h-4 w-4 animate-spin" />
              <Sparkles v-else class="h-4 w-4" />
              {{ job?.planVersion ? t('knowledge.ingest.regeneratePlan') : t('knowledge.ingest.generatePlan') }}
            </button>
            <button
              type="button"
              class="btn-ghost text-sm"
              :disabled="!job?.planVersion"
              :title="hintTitle(exportPromptHint)"
              @click="exportPrompt"
            >
              <ClipboardCopy class="h-4 w-4" /> {{ t('knowledge.ingest.exportPrompt') }}
            </button>
            <button
              type="button"
              class="btn-primary text-sm"
              :disabled="planSaving || !jobCanEdit || !planObj"
              :title="hintTitle(savePlanHint)"
              @click="savePlan"
            >
              {{ t('knowledge.ingest.savePlan') }}
            </button>
          </div>
        </div>
        <p v-if="planGenerateHint || exportPromptHint || savePlanHint" class="mt-2 rounded-md bg-amber-50/90 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <span v-if="planGenerateHint && (planGenerating || !jobCanEdit)">{{ planGenerateHint }}</span>
          <span v-else-if="exportPromptHint && !job?.planVersion">{{ exportPromptHint }}</span>
          <span v-else-if="savePlanHint">{{ savePlanHint }}</span>
        </p>
        <p v-else-if="job && !job.planVersion && !planText" class="mt-3 text-xs text-gray-400">{{ t('knowledge.ingest.planEmpty') }}</p>
        <p v-if="job?.planSource" class="mt-2 text-xs text-gray-400">{{ t('knowledge.ingest.planSource', { source: job.planSource }) }}</p>
        <textarea
          v-model="planText"
          class="field-input mt-3 min-h-[min(40vh,26rem)] resize-y font-mono text-xs leading-relaxed"
          :placeholder="t('knowledge.ingest.planEditorPlaceholder')"
          spellcheck="false"
          :disabled="!jobCanEdit"
        />
        <div v-if="conflicts.length" class="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <p class="mb-1 font-medium">{{ t('knowledge.ingest.conflictsTitle') }}</p>
          <ul class="list-disc pl-4">
            <li v-for="(c, i) in conflicts" :key="i">{{ c }}</li>
          </ul>
        </div>
      </div>

      <!-- ② Drafts + diff -->
      <div class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.draftsSection') }}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="btn-ghost text-sm"
              :disabled="draftsGenerating || !jobCanEdit || !job?.planVersion || !drafts.length"
              :title="hintTitle(resumeGenerateHint)"
              @click="generateDrafts(true)"
            >
              <Loader2 v-if="draftsGenerating" class="h-4 w-4 animate-spin" />
              <Play v-else class="h-4 w-4" />
              {{ t('knowledge.ingest.resumeGenerate') }}
            </button>
            <button
              type="button"
              class="btn-ghost text-sm"
              :disabled="draftsGenerating || !jobCanEdit || !job?.planVersion"
              :title="hintTitle(generateDraftsHint)"
              @click="generateDrafts(false)"
            >
              <RefreshCw class="h-4 w-4" :class="draftsGenerating && 'animate-spin'" />
              {{ draftsGenerating ? t('knowledge.ingest.draftsGenerating') : t('knowledge.ingest.generateDrafts') }}
            </button>
          </div>
        </div>

        <p v-if="generateDraftsHint" class="mt-2 rounded-md bg-amber-50/90 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {{ generateDraftsHint }}
        </p>
        <p v-else-if="resumeGenerateHint && !drafts.length" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ resumeGenerateHint }}
        </p>

        <p v-if="lastGenerateStats" class="mt-2 text-xs text-gray-400">
          {{ t('knowledge.ingest.generateProgress', lastGenerateStats) }}
        </p>

        <div
          v-if="!drafts.length"
          class="mt-3 flex min-h-[min(36vh,22rem)] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-6 py-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
        >
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.noDrafts') }}</p>
          <p v-if="hasSavedPlan && !generateDraftsHint" class="mt-2 text-xs text-brand-600 dark:text-brand-300">
            {{ t('knowledge.ingest.hintClickGenerateDrafts') }}
          </p>
          <p v-else-if="generateDraftsHint" class="mt-2 text-xs text-amber-700 dark:text-amber-300">{{ generateDraftsHint }}</p>
        </div>

        <div v-else class="mt-4 flex flex-col gap-4 lg:flex-row">
          <!-- 草稿列表 -->
          <ul class="flex shrink-0 flex-col gap-1.5 lg:w-64">
            <li
              v-for="d in drafts"
              :key="d.slug"
              class="cursor-pointer rounded-lg border px-3 py-2 text-xs"
              :class="d.slug === activeSlug
                ? 'border-brand-300 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/10'
                : 'border-gray-100 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5'"
              @click="selectDraft(d)"
            >
              <div class="flex items-center justify-between gap-1">
                <span class="truncate font-medium text-gray-800 dark:text-gray-100">{{ d.displaySlug }}</span>
                <span class="badge shrink-0" :class="approvalBadgeClass(d.approval)">{{ approvalLabel(d.approval) }}</span>
              </div>
              <p class="mt-0.5 truncate text-gray-400">
                {{ d.action === 'enrich' ? t('knowledge.ingest.enrichLabel') : t('knowledge.ingest.createLabel') }} · {{ d.kbType }}
              </p>
            </li>
          </ul>

          <!-- diff / edit -->
          <div class="flex min-h-0 min-w-0 flex-1 flex-col">
            <p v-if="!activeDraft" class="p-4 text-xs text-gray-400">{{ t('knowledge.ingest.selectDraft') }}</p>
            <template v-else>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <SegmentControl v-model="draftTab" :options="draftTabOptions" />
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="btn-ghost text-xs"
                    :disabled="draftRegenerating || !jobCanEdit"
                    @click="regenerateDraft"
                  >
                    <RefreshCw class="h-3.5 w-3.5" :class="draftRegenerating && 'animate-spin'" /> {{ t('knowledge.ingest.regenerate') }}
                  </button>
                  <button
                    type="button"
                    class="btn-ghost text-xs text-emerald-600 dark:text-emerald-400"
                    :disabled="!jobCanEdit"
                    @click="setApproval(activeDraft, 'approved')"
                  >
                    <Check class="h-3.5 w-3.5" /> {{ t('knowledge.ingest.approve') }}
                  </button>
                  <button
                    type="button"
                    class="btn-ghost text-xs text-rose-500"
                    :disabled="!jobCanEdit"
                    @click="setApproval(activeDraft, 'rejected')"
                  >
                    <X class="h-3.5 w-3.5" /> {{ t('knowledge.ingest.reject') }}
                  </button>
                </div>
              </div>

              <div
                v-if="draftTab === 'diff'"
                class="mt-3 min-h-[min(44vh,28rem)] flex-1 overflow-auto rounded-lg border border-gray-100 bg-gray-50/50 font-mono text-xs leading-relaxed dark:border-white/5 dark:bg-white/[0.02]"
              >
                <table class="w-full border-collapse">
                  <tbody>
                    <tr
                      v-for="(row, i) in diffRows"
                      :key="i"
                      :class="{
                        'bg-emerald-50 dark:bg-emerald-500/10': row.type === 'add',
                        'bg-rose-50 dark:bg-rose-500/10': row.type === 'del',
                      }"
                    >
                      <td class="select-none border-r border-gray-100 px-2 text-right align-top text-gray-300 dark:border-white/5">{{ row.type === 'add' ? '' : row.oldNo }}</td>
                      <td class="select-none border-r border-gray-100 px-2 text-right align-top text-gray-300 dark:border-white/5">{{ row.type === 'del' ? '' : row.newNo }}</td>
                      <td class="whitespace-pre-wrap break-all px-2 align-top text-gray-700 dark:text-gray-200">{{ row.text }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <template v-else-if="draftTab === 'edit'">
                <textarea
                  v-model="draftEditContent"
                  class="field-input mt-3 min-h-[min(44vh,28rem)] flex-1 resize-y font-mono text-xs leading-relaxed"
                  spellcheck="false"
                  :disabled="!jobCanEdit"
                />
                <button
                  type="button"
                  class="btn-primary mt-3 self-start text-sm"
                  :disabled="draftSaving || !jobCanEdit"
                  @click="saveDraft"
                >
                  <Loader2 v-if="draftSaving" class="h-4 w-4 animate-spin" />
                  {{ t('knowledge.ingest.saveDraft') }}
                </button>
              </template>

              <template v-else-if="draftTab === 'patch'">
                <p class="mt-2 text-xs text-gray-400">{{ t('knowledge.ingest.patchEditHint') }}</p>
                <textarea
                  v-model="draftPatchContent"
                  class="field-input mt-2 min-h-[min(36vh,22rem)] flex-1 resize-y font-mono text-xs leading-relaxed"
                  spellcheck="false"
                  :disabled="!jobCanEdit"
                />
                <div
                  v-if="patchDiffRows.length"
                  class="mt-3 max-h-[160px] overflow-auto rounded-lg border border-gray-100 bg-gray-50/50 font-mono text-xs leading-relaxed dark:border-white/5 dark:bg-white/[0.02]"
                >
                  <table class="w-full border-collapse">
                    <tbody>
                      <tr
                        v-for="(row, i) in patchDiffRows"
                        :key="i"
                        class="bg-emerald-50 dark:bg-emerald-500/10"
                      >
                        <td class="whitespace-pre-wrap break-all px-2 align-top text-gray-700 dark:text-gray-200">{{ row.text }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  class="btn-primary mt-3 self-start text-sm"
                  :disabled="draftSaving || !jobCanEdit"
                  @click="saveDraft"
                >
                  <Loader2 v-if="draftSaving" class="h-4 w-4 animate-spin" />
                  {{ t('knowledge.ingest.saveDraft') }}
                </button>
              </template>
            </template>
          </div>
        </div>
      </div>

      <!-- ③ Lint + commit -->
      <div v-if="drafts.length" class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.lintSection') }}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn-ghost text-sm" :disabled="linting" @click="runLint">
              <Loader2 v-if="linting" class="h-4 w-4 animate-spin" />
              {{ t('knowledge.ingest.runLint') }}
            </button>
            <button
              type="button"
              class="btn-ghost text-sm"
              :disabled="committing || !canCommit"
              :title="hintTitle(commitHint)"
              @click="commit(false)"
            >
              {{ t('knowledge.ingest.commit') }}
            </button>
            <button
              type="button"
              class="btn-primary text-sm"
              :disabled="committing || !canCommit"
              :title="hintTitle(commitHint)"
              @click="commit(true)"
            >
              <Loader2 v-if="committing" class="h-4 w-4 animate-spin" />
              <Upload v-else class="h-4 w-4" />
              {{ t('knowledge.ingest.commitAndSync') }}
            </button>
          </div>
        </div>

        <p v-if="commitHint && !canCommit" class="mt-2 rounded-md bg-amber-50/90 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {{ commitHint }}
        </p>

        <p v-if="!allApproved && canCommit === false && !commitHint" class="mt-3 text-xs text-amber-600 dark:text-amber-400">{{ t('knowledge.ingest.lintNeedApprove') }}</p>

        <div v-if="lint" class="mt-3">
          <p v-if="lint.commitReady" class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{{ t('knowledge.ingest.lintReady') }}</p>
          <p v-else-if="lint.blockingCount" class="text-xs font-medium text-rose-500">{{ t('knowledge.ingest.lintBlocked', { count: lint.blockingCount }) }}</p>
          <p v-if="!lint.issues.length" class="mt-1 text-xs text-gray-400">{{ t('knowledge.ingest.noLintIssues') }}</p>
          <ul v-else class="mt-2 flex flex-col gap-1.5">
            <li
              v-for="(it, i) in lint.issues"
              :key="i"
              class="rounded-lg border px-3 py-1.5 text-xs"
              :class="it.severity === 'ERROR'
                ? 'border-rose-100 bg-rose-50/60 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
                : 'border-amber-100 bg-amber-50/60 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'"
            >
              <span class="font-mono">[{{ it.severity }}]</span>
              <span v-if="it.slug" class="ml-1 font-medium">{{ it.slug }}</span>
              <span class="ml-1">{{ it.message }}</span>
            </li>
          </ul>
        </div>
      </div>
      </template>
    </template>

    <AppModal
      :open="saveTemplateOpen"
      :title="t('knowledge.ingest.saveAsTemplate')"
      @close="saveTemplateOpen = false"
    >
      <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.saveAsTemplateDesc') }}</p>
      <label class="flex flex-col gap-1.5">
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.saveAsTemplatePrompt') }}</span>
        <input
          v-model="saveTemplateName"
          type="text"
          class="field-input"
          :placeholder="t('knowledge.ingest.saveAsTemplatePlaceholder')"
          @keydown.enter.prevent="submitSaveTemplate"
        />
      </label>
      <p v-if="job?.planVersion" class="mt-2 text-xs text-gray-400">{{ t('knowledge.ingest.saveAsTemplateIncludePlan') }}</p>
      <template #footer>
        <button type="button" class="btn-ghost" :disabled="saveTemplateSaving" @click="saveTemplateOpen = false">
          {{ t('confirm.cancel') }}
        </button>
        <button type="button" class="btn-primary" :disabled="saveTemplateSaving || !saveTemplateName.trim()" @click="submitSaveTemplate">
          <Loader2 v-if="saveTemplateSaving" class="h-4 w-4 animate-spin" />
          {{ saveTemplateSaving ? t('common.loading') : t('confirm.ok') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
