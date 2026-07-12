<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Check, CheckCircle2, ClipboardCopy, Loader2, Play, RefreshCw, Sparkles, Trash2, Upload, X, Zap } from 'lucide-vue-next'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import IngestExpressProgressPanel, { type IngestExpressProgressStep } from '@/components/knowledge/IngestExpressProgressPanel.vue'
import KbWorkflowNextSteps from '@/components/knowledge/KbWorkflowNextSteps.vue'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'
import KbImportDecisionHint from '@/components/knowledge/KbImportDecisionHint.vue'
import KbRawUploadPanel from '@/components/knowledge/KbRawUploadPanel.vue'
import KbWikiImportPanel from '@/components/knowledge/KbWikiImportPanel.vue'
import IngestRawTreeList from '@/components/knowledge/IngestRawTreeList.vue'
import IngestPlanCreateTable from '@/components/knowledge/IngestPlanCreateTable.vue'
import {
  commitKbIngestApi,
  createKbIngestJobApi,
  createKbIngestJobFromTemplateApi,
  deleteKbIngestJobApi,
  deleteKbIngestTemplateApi,
  exportKbIngestAgentPromptApi,
  expressStartKbIngestApi,
  prepareKbIngestApi,
  generateKbIngestDraftsApi,
  startKbIngestGenerateApi,
  subscribeKbIngestGenerateStream,
  generateKbIngestPlanApi,
  getKbCategoryTreeApi,
  getKbIngestJobApi,
  getKbIngestJobsApi,
  getKbIngestDraftsApi,
  getKbIngestRawTreeApi,
  getKbIngestRawCoverageApi,
  getKbIngestTemplatesApi,
  lintKbIngestApi,
  publishKbIngestApi,
  regenerateKbIngestDraftApi,
  saveKbIngestJobAsTemplateApi,
  setKbIngestDraftApprovalApi,
  updateKbIngestDraftApi,
  updateKbIngestPlanApi,
} from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { useActionPermissions } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { toEntityId } from '@/utils/id'
import { diffLines, type DiffRow } from '@/utils/lineDiff'
import { flattenKbCategoryTree } from '@/utils/kbCategoryTree'
import { collectWorkflowNextSteps, isIngestRawClusterConflict, parseIngestCommitFailure } from '@/utils/ingestCommitError'
import {
  applyCategoryInference,
  buildCategoryIndex,
  createRowToPlanItem,
  parseCreateRowsFromPlan,
  previewRelPath,
  wikiCommitPath,
  wikiDirForSpace,
  type IngestPlanCreateRow,
} from '@/utils/ingestPlanPath'
import type {
  KbCategoryTree,
  KbRawCoverage,
  KbRawCoverageFilter,
  KbRawCoverageItem,
  KbIngestDraft,
  KbIngestGenerateResult,
  KbIngestJob,
  KbIngestLint,
  KbIngestRawConflictItem,
  KbIngestTemplate,
  KbRawTreeNode,
  KbAccessibleSpace,
  KbWorkflowHintVo,
} from '@/types/knowledge'
import type { IngestRawHighlightPayload } from '@/types/kbImport'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { spaces, ensureSpacesLoaded } = useKbSpace()
const { fullPermission, assertAction } = useActionPermissions()

const ingestSpaceCode = ref('')
type ImportEntryTab = 'raw' | 'ingest' | 'wiki'
const importEntryTab = ref<ImportEntryTab>('ingest')
const highlightedRawPaths = ref<Set<string>>(new Set())

const importTabOptions = computed(() => [
  { value: 'raw' as const, label: t('knowledge.ingest.tabRawUpload') },
  { value: 'ingest' as const, label: t('knowledge.ingest.tabIngest') },
  { value: 'wiki' as const, label: t('knowledge.ingest.tabWikiImport') },
])

const canSyncTrigger = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))

const jobId = computed(() => {
  const raw = route.query.id
  const v = Array.isArray(raw) ? raw[0] : raw
  return toEntityId(typeof v === 'string' ? v : undefined) ?? undefined
})

const expressMode = computed(() => {
  const raw = route.query.express
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === '1' || v === 'true'
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
const creating = ref(false)
const expressStarting = ref(false)
const expressProcessing = ref(false)
const publishingExpress = ref(false)
const expressSkeletonPlan = ref(true)
const templateMode = ref(false)
const templateModeActive = ref(false)

const EXPRESS_PROGRESS_STEPS = ['create', 'plan', 'generate', 'lint', 'commit', 'sync'] as const satisfies readonly IngestExpressProgressStep[]
const expressProgressStage = ref<IngestExpressProgressStep | null>(null)
const expressProgressPercent = ref(0)
let expressProgressTimer: ReturnType<typeof setInterval> | null = null

const expressProgressActive = computed(() => expressStarting.value || publishingExpress.value)

function expressProgressBase(step: IngestExpressProgressStep) {
  const idx = EXPRESS_PROGRESS_STEPS.indexOf(step)
  return (idx / EXPRESS_PROGRESS_STEPS.length) * 100
}

function stopExpressProgressCreep() {
  if (expressProgressTimer) {
    clearInterval(expressProgressTimer)
    expressProgressTimer = null
  }
}

function startExpressProgressCreep(step: IngestExpressProgressStep) {
  stopExpressProgressCreep()
  const base = expressProgressBase(step)
  const cap = base + 100 / EXPRESS_PROGRESS_STEPS.length - 1
  expressProgressTimer = setInterval(() => {
    if (expressProgressPercent.value < cap) {
      expressProgressPercent.value = Math.min(cap, expressProgressPercent.value + 0.35)
    }
  }, 350)
}

function setExpressProgressStage(step: IngestExpressProgressStep) {
  expressProgressStage.value = step
  expressProgressPercent.value = expressProgressBase(step)
  startExpressProgressCreep(step)
}

function finishExpressProgress() {
  stopExpressProgressCreep()
  expressProgressPercent.value = 100
  if (expressPublishCompleted.value) return
  setTimeout(() => {
    expressProgressStage.value = null
    expressProgressPercent.value = 0
  }, 1200)
}

function resetExpressProgress() {
  stopExpressProgressCreep()
  expressProgressStage.value = null
  expressProgressPercent.value = 0
}

const templates = ref<KbIngestTemplate[]>([])
const templatesLoading = ref(false)
const creatingFromTemplate = ref(false)
const saveTemplateOpen = ref(false)
const saveTemplateName = ref('')
const saveTemplateSaving = ref(false)

const deletingJobId = ref<string | null>(null)
const deletingTemplateId = ref<string | null>(null)

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
  () => spaces.value.find((s) => s.spaceCode === ingestSpaceCode.value) ?? null,
)
const selectedSpaceQueryId = computed(() => toEntityId(selectedSpace.value?.id))
const canEdit = computed(() => spaceCanIngestEdit(selectedSpace.value))

const rawUploadBlockedReason = computed(() => {
  if (!editableSpaces.value.length) return t('knowledge.ingest.noEditableSpace')
  if (!canEdit.value) return t('knowledge.ingest.readOnlyHint')
  if (!assertAction(PERM.KB_INGEST_RAW_UPLOAD)) return t('knowledge.ingest.rawUpload.noPermission')
  return ''
})
const canRawUpload = computed(() => !rawUploadBlockedReason.value)
const canWikiImport = computed(() => canEdit.value)

function initIngestSpace() {
  if (jobId.value || !spaces.value.length) return
  const cur = ingestSpaceCode.value.trim()
  const ok = editableSpaces.value.some((s) => s.spaceCode === cur)
  const pick = editableSpaces.value[0] ?? defaultSpace.value
  const code = pick?.spaceCode
  if (code && (!ok || !cur)) ingestSpaceCode.value = code
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

function expressApiOpts() {
  return {
    useLlmPlan: !expressSkeletonPlan.value,
    useLlmGenerate: !templateMode.value,
  }
}

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

function expandRawPathPrefixes(paths: string[]) {
  const next = new Set(rawExpandedDirs.value)
  for (const rawPath of paths) {
    const dir = rawPath.includes('/') ? rawPath.slice(0, rawPath.lastIndexOf('/')) : ''
    if (dir) {
      const parts = dir.split('/').filter(Boolean)
      for (let i = 1; i <= parts.length; i++) {
        next.add(parts.slice(0, i).join('/'))
      }
    }
  }
  rawExpandedDirs.value = next
}

async function applyRawHighlight(payload: IngestRawHighlightPayload) {
  importEntryTab.value = 'ingest'
  highlightedRawPaths.value = new Set(payload.highlightRawPaths)
  await reloadRawSources()
  const expandKeys = [...payload.highlightRawPaths]
  if (payload.expandPrefix?.trim()) expandKeys.push(payload.expandPrefix.trim())
  expandRawPathPrefixes(expandKeys)
  const nextSelected = new Set(selectedRaw.value)
  for (const p of payload.highlightRawPaths) nextSelected.add(p)
  selectedRaw.value = nextSelected
  rawCoverageFilter.value = 'all'
}

function onRawUploadSwitchTab(_tab: 'ingest', payload: IngestRawHighlightPayload) {
  void applyRawHighlight(payload)
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

async function removeJob(job: KbIngestJob, event?: Event) {
  event?.stopPropagation()
  if (!guardIngestEdit()) return
  const id = toEntityId(job.id)
  if (!id || deletingJobId.value) return
  const label = job.topic?.trim() || job.batchNo || id
  const ok = await confirm({
    title: t('knowledge.ingest.deleteJob'),
    message: t('knowledge.ingest.deleteJobConfirm', { topic: label }),
    confirmText: t('knowledge.ingest.deleteJob'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  deletingJobId.value = id
  try {
    const res = await deleteKbIngestJobApi(id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    showToast('success', t('knowledge.ingest.deleteJobOk'))
    jobs.value = jobs.value.filter((j) => toEntityId(j.id) !== id)
    if (jobId.value === id) backToList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    deletingJobId.value = null
  }
}

async function removeTemplate(tpl: KbIngestTemplate) {
  if (!guardIngestEdit()) return
  const id = toEntityId(tpl.id)
  if (!id || deletingTemplateId.value) return
  const ok = await confirm({
    title: t('knowledge.ingest.deleteTemplate'),
    message: t('knowledge.ingest.deleteTemplateConfirm', { name: tpl.name ?? id }),
    confirmText: t('knowledge.ingest.deleteTemplate'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  deletingTemplateId.value = id
  try {
    const res = await deleteKbIngestTemplateApi(id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    showToast('success', t('knowledge.ingest.deleteTemplateOk'))
    templates.value = templates.value.filter((x) => toEntityId(x.id) !== id)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    deletingTemplateId.value = null
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

function buildExpressPathLines(draftList: KbIngestDraft[], spaceCode?: string): string[] {
  const root = wikiDirForSpace(spaceCode)
  return draftList.map((d) => {
    const slug = d.slug.replace(/\.md$/, '')
    return `${root}/${slug}.md`
  })
}

function buildExpressPathLinesFromPlan(spaceCode?: string): string[] {
  const root = wikiDirForSpace(spaceCode)
  const idx = buildCategoryIndex(categoryTree.value)
  return planCreateRows.value
    .map((row) => {
      const rel = previewRelPath(row, row.categoryId ? idx.get(row.categoryId) : undefined)
      return rel ? `${root}/${rel}.md` : ''
    })
    .filter(Boolean)
}

const expressTargetPaths = computed(() => {
  if (drafts.value.length) return buildExpressPathLines(drafts.value, job.value?.spaceCode)
  return buildExpressPathLinesFromPlan(job.value?.spaceCode)
})

const expressPipelineBusy = computed(
  () => expressProcessing.value || draftsGenerating.value || planGenerating.value,
)

function openExpertReview() {
  if (!jobId.value) return
  void router.push({ path: '/knowledge/ingest', query: { id: String(jobId.value) } })
}

async function ensureExpressPipeline() {
  if (!expressMode.value || !jobId.value || !jobCanEdit.value) return
  if (job.value?.status === 'committed') return
  if (expressPipelineBusy.value) return
  const needPlan = !hasSavedPlan.value
  const needDrafts = !drafts.value.length
  if (!needPlan && !needDrafts) return

  expressProcessing.value = true
  try {
    if (needPlan) {
      const res = await prepareKbIngestApi(jobId.value, expressApiOpts())
      if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
      if (res.data.job) {
        job.value = res.data.job
        planText.value = res.data.job.planJson ? prettyJson(res.data.job.planJson) : ''
        syncRowsFromPlanText()
      }
      if (res.data.drafts?.length) drafts.value = res.data.drafts
    }
    if (!drafts.value.length && hasSavedPlan.value) {
      const res = await generateKbIngestDraftsApi(jobId.value, { resume: true })
      if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
      drafts.value = res.data.drafts ?? []
      if (!drafts.value.length) throw new Error(t('knowledge.ingest.expressNoDrafts'))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.expressPipelineFailed'))
  } finally {
    expressProcessing.value = false
  }
}

async function expressIngest() {
  if (!guardIngestEdit()) return
  if (expressStarting.value || creating.value) return
  if (!formTopic.value.trim()) {
    showToast('error', t('knowledge.ingest.topic'))
    return
  }
  if (selectedRaw.value.size === 0) {
    showToast('error', t('knowledge.ingest.selected', { count: 0 }))
    return
  }
  const rawCount = selectedRaw.value.size
  const ok = await confirm({
    title: t('knowledge.ingest.expressPreview'),
    message: t('knowledge.ingest.expressPreviewConfirmIntro', { count: rawCount, topic: formTopic.value.trim() }),
    confirmText: t('knowledge.ingest.expressPreview'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return

  expressStarting.value = true
  setExpressProgressStage('create')
  try {
    setExpressProgressStage('plan')
    const res = await expressStartKbIngestApi(
      {
        spaceId: selectedSpaceQueryId.value,
        topic: formTopic.value.trim(),
        batchNo: formBatchNo.value.trim() || undefined,
        rawPaths: Array.from(selectedRaw.value),
      },
      expressApiOpts(),
    )
    setExpressProgressStage('generate')
    if (res.code !== API_SUCCESS_CODE || !res.data?.job?.id) {
      throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    }
    const jobIdStr = String(res.data.job.id)
    const draftList = res.data.prepare?.drafts ?? []
    const gen = res.data.prepare?.generate
    if (!draftList.length) throw new Error(t('knowledge.ingest.expressNoDrafts'))
    if (gen?.failed && gen.failed > 0) {
      throw new Error(t('knowledge.ingest.expressPreparePartial', { failed: gen.failed }))
    }

    applyGenerateResultMeta(gen ?? undefined)
    finishExpressProgress()
    selectedRaw.value = new Set()
    await loadJobs()
    showToast('success', t('knowledge.ingest.expressPreviewSuccess', { count: draftList.length }))
    void router.push({ path: '/knowledge/ingest', query: { id: jobIdStr, express: '1' } })
  } catch (e) {
    resetExpressProgress()
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    expressStarting.value = false
  }
}

/* ---------------- 批次详情模式 ---------------- */
const job = ref<KbIngestJob | null>(null)
const jobLoading = ref(false)
const jobLoadError = ref('')

function resolveJobSpaceLabel(j: Pick<KbIngestJob, 'spaceCode' | 'spaceId'> | null | undefined): string {
  if (!j) return ''
  if (j.spaceCode) {
    const byCode = spaces.value.find((s) => s.spaceCode === j.spaceCode)
    if (byCode?.spaceName) return byCode.spaceName
  }
  const sid = toEntityId(j.spaceId)
  if (sid) {
    const byId = spaces.value.find((s) => toEntityId(s.id) === sid)
    if (byId?.spaceName) return byId.spaceName
  }
  return j.spaceCode?.trim() || sid || ''
}

const jobSpaceLabel = computed(() => resolveJobSpaceLabel(job.value))
const planText = ref('')
const planGenerating = ref(false)
const planSaving = ref(false)
const planJsonAdvanced = ref(false)
const planCreateRows = ref<IngestPlanCreateRow[]>([])
const syncingPlan = ref(false)
const categoryTree = ref<KbCategoryTree[]>([])
const categoriesLoading = ref(false)

const categoryOptions = computed(() => {
  const index = buildCategoryIndex(categoryTree.value)
  return flattenKbCategoryTree(categoryTree.value).map((opt) => {
    const cat = index.get(opt.id)
    if (cat?.dirSlug) {
      const base = opt.label.replace(/^[　└\s]+/, '').trim()
      const prefix = opt.label.slice(0, opt.label.indexOf(base))
      return { ...opt, label: `${prefix}${base} (${cat.dirSlug})` }
    }
    return opt
  })
})

const drafts = ref<KbIngestDraft[]>([])
const draftsGenerating = ref(false)
const generateLiveSlug = ref('')
const activeSlug = ref('')
const draftTab = ref<'diff' | 'edit' | 'patch'>('diff')
const draftEditContent = ref('')
const draftPatchContent = ref('')
const draftSaving = ref(false)
const draftRegenerating = ref(false)

const lint = ref<KbIngestLint | null>(null)
const linting = ref(false)
const committing = ref(false)
const workflowNextSteps = ref<KbWorkflowHintVo[]>([])
const expressPublishSummary = ref<{ created: number; updated: number; syncOk?: boolean } | null>(null)
const expressPublishCompleted = ref(false)
const commitErrorMessage = ref('')
const commitErrorCode = ref<number | undefined>()
const commitErrorConflicts = ref<KbIngestRawConflictItem[]>([])
const commitErrorIsCluster = computed(
  () =>
    commitErrorConflicts.value.length > 0 ||
    isIngestRawClusterConflict(commitErrorMessage.value, commitErrorCode.value),
)

function clearCommitError() {
  commitErrorMessage.value = ''
  commitErrorCode.value = undefined
  commitErrorConflicts.value = []
}

function applyCommitFailureFromResponse(res: { code: number; msg?: string; data?: unknown }) {
  const failure = parseIngestCommitFailure(res)
  commitErrorMessage.value = failure.message
  commitErrorCode.value = failure.apiCode
  commitErrorConflicts.value = failure.conflicts
}

function applyGenerateResultMeta(result?: Pick<KbIngestGenerateResult, 'templateMode' | 'llmFallback' | 'llmFallbackReason'>) {
  if (!result) return
  if (result.templateMode) templateModeActive.value = true
  if (result.llmFallback) {
    const reason = result.llmFallbackReason?.trim()
    showToast(
      'success',
      reason ? t('knowledge.ingest.llmFallbackToastWithReason', { reason }) : t('knowledge.ingest.llmFallbackToast'),
    )
  }
}

const lastGenerateStats = ref<{ generated: number; skipped: number; failed: number; total: number } | null>(null)

async function finishGenerateFromResult(data: KbIngestGenerateResult) {
  applyGenerateResultMeta(data)
  drafts.value = data.drafts ?? []
  lastGenerateStats.value = {
    generated: data.generated ?? 0,
    skipped: data.skipped ?? 0,
    failed: data.failed ?? 0,
    total: data.total ?? drafts.value.length,
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
}

async function runGenerateDraftsSync(resume: boolean) {
  const res = await generateKbIngestDraftsApi(jobId.value!, { resume, useLlmGenerate: !templateMode.value })
  if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
  await finishGenerateFromResult(res.data)
}

async function runGenerateDraftsAsync(resume: boolean) {
  const start = await startKbIngestGenerateApi(jobId.value!, { resume, useLlmGenerate: !templateMode.value })
  if (start.code !== API_SUCCESS_CODE || !start.data?.taskId) {
    throw new Error(start.msg || t('knowledge.ingest.opFailed'))
  }
  const taskId = start.data.taskId
  lastGenerateStats.value = {
    generated: 0,
    skipped: 0,
    failed: 0,
    total: start.data.total ?? 0,
  }

  await subscribeKbIngestGenerateStream(jobId.value!, taskId, {
    onPageStart: (d) => {
      generateLiveSlug.value = d.slug ?? ''
    },
    onProgress: (p) => {
      lastGenerateStats.value = {
        generated: p.generated,
        skipped: p.skipped,
        failed: p.failed,
        total: p.total,
      }
    },
    onComplete: async (data) => {
      applyGenerateResultMeta(data)
      lastGenerateStats.value = {
        generated: data.generated ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
        total: data.total ?? 0,
      }
    },
    onError: (msg) => {
      throw new Error(msg)
    },
  })

  generateLiveSlug.value = ''
  await loadDrafts()
  const failed = lastGenerateStats.value?.failed ?? 0
  lint.value = null
  await loadJob()
  showToast(
    failed > 0 ? 'error' : 'success',
    t('knowledge.ingest.generateProgress', {
      generated: lastGenerateStats.value?.generated ?? 0,
      skipped: lastGenerateStats.value?.skipped ?? 0,
      total: lastGenerateStats.value?.total ?? 0,
    }) + (failed > 0 ? ' ' + t('knowledge.ingest.generateFailed', { failed }) : ''),
  )
}

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

type CommitPathPreview = {
  slug: string
  displaySlug: string
  action: string
  path: string
}

const approvedCommitPaths = computed<CommitPathPreview[]>(() => {
  const spaceCode = job.value?.spaceCode
  return drafts.value
    .filter((d) => d.approval === 'approved')
    .map((d) => ({
      slug: d.slug,
      displaySlug: d.displaySlug,
      action: d.action,
      path: wikiCommitPath(spaceCode, d.slug),
    }))
})

const wikiRootDir = computed(() => wikiDirForSpace(job.value?.spaceCode))

function buildCommitConfirmMessage(expressAll = false): string {
  const paths = expressAll
    ? drafts.value.map((d) => wikiCommitPath(job.value?.spaceCode, d.slug))
    : approvedCommitPaths.value.map((p) => p.path)
  const count = expressAll ? drafts.value.length : approvedCount.value
  const intro = expressAll
    ? t('knowledge.ingest.expressCommitConfirmIntro', { count })
    : t('knowledge.ingest.commitConfirmIntro', { count })
  const lines = paths.map((p) => `• ${p}`)
  const shown = lines.slice(0, 12)
  const tail = lines.length > 12 ? `\n… +${lines.length - 12}` : ''
  return `${intro}\n\n${shown.join('\n')}${tail}`
}

const canPublishExpress = computed(
  () => jobCanEdit.value && drafts.value.length > 0 && job.value?.status !== 'committed',
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
  if (!planJsonAdvanced.value && planCreateRows.value.length) {
    try {
      const base = planText.value.trim() ? JSON.parse(planText.value) : {}
      return { ...base, create: planCreateRows.value.map(createRowToPlanItem) }
    } catch {
      return null
    }
  }
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
    syncRowsFromPlanText()
    await Promise.all([loadDrafts(), loadCategories()])
    if (expressMode.value && res.data.status === 'committed') {
      expressPublishCompleted.value = true
      expressProgressStage.value = 'sync'
      expressProgressPercent.value = 100
    }
    if (expressMode.value) await ensureExpressPipeline()
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

function syncRowsFromPlanText() {
  if (!planText.value.trim()) {
    planCreateRows.value = []
    return
  }
  try {
    const obj = JSON.parse(planText.value)
    let rows = parseCreateRowsFromPlan(obj?.create)
    rows = applyCategoryInference(rows, categoryTree.value)
    planCreateRows.value = rows
  } catch {
    planCreateRows.value = []
  }
}

function applyRowsToPlanText() {
  if (!planText.value.trim() && !planCreateRows.value.length) return
  let base: Record<string, unknown> = {}
  try {
    base = planText.value.trim() ? JSON.parse(planText.value) : {}
  } catch {
    return
  }
  base.create = planCreateRows.value.map(createRowToPlanItem)
  syncingPlan.value = true
  planText.value = prettyJson(JSON.stringify(base))
  void nextTick(() => {
    syncingPlan.value = false
  })
}

async function loadCategories() {
  const sid = toEntityId(job.value?.spaceId)
  if (!sid) {
    categoryTree.value = []
    return
  }
  categoriesLoading.value = true
  try {
    const res = await getKbCategoryTreeApi(sid, false)
    if (res.code === API_SUCCESS_CODE && res.data) {
      categoryTree.value = res.data
      if (planCreateRows.value.length) {
        planCreateRows.value = applyCategoryInference(planCreateRows.value, res.data)
        if (!planJsonAdvanced.value) applyRowsToPlanText()
      }
    }
  } catch {
    categoryTree.value = []
  } finally {
    categoriesLoading.value = false
  }
}

function togglePlanJsonAdvanced() {
  if (planJsonAdvanced.value) {
    syncRowsFromPlanText()
    planJsonAdvanced.value = false
  } else {
    applyRowsToPlanText()
    planJsonAdvanced.value = true
  }
}

function draftPathTooltip(d: KbIngestDraft) {
  const parts = [d.slug]
  if (d.categoryName && d.dirSlug) parts.push(`${d.categoryName} (${d.dirSlug}/)`)
  else if (d.dirSlug) parts.push(`${d.dirSlug}/`)
  return parts.join(' · ')
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
    syncRowsFromPlanText()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    planGenerating.value = false
  }
}

async function savePlan() {
  if (!guardIngestEdit()) return
  if (!jobId.value || planSaving.value) return
  if (!planJsonAdvanced.value) applyRowsToPlanText()
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
  generateLiveSlug.value = ''
  try {
    try {
      await runGenerateDraftsAsync(resume)
    } catch (sseErr) {
      const msg = sseErr instanceof Error ? sseErr.message : ''
      const fallback =
        msg.includes('404') ||
        msg.includes('405') ||
        msg.includes('异步 generate 未启用') ||
        msg.includes('SSE')
      if (fallback) {
        await runGenerateDraftsSync(resume)
      } else {
        throw sseErr
      }
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    generateLiveSlug.value = ''
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
    const res = await regenerateKbIngestDraftApi(jobId.value, d.slug, !templateMode.value)
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
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    replaceDraft(res.data ?? { ...d, approval })
    lint.value = null
    if (approval === 'approved') showToast('success', t('knowledge.ingest.approveOk'))
    else if (approval === 'rejected') showToast('success', t('knowledge.ingest.rejectOk'))
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

async function publishExpress() {
  if (!guardIngestEdit()) return
  if (!jobId.value || publishingExpress.value) return
  if (!drafts.value.length) {
    showToast('error', t('knowledge.ingest.noDrafts'))
    return
  }
  clearCommitError()
  const ok = await confirm({
    title: t('knowledge.ingest.expressPublish'),
    message: `${t('knowledge.ingest.expressPublishConfirm')}\n\n${buildCommitConfirmMessage(true)}`,
    confirmText: t('knowledge.ingest.expressPublish'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  publishingExpress.value = true
  setExpressProgressStage('lint')
  try {
    setExpressProgressStage('commit')
    const res = await publishKbIngestApi(jobId.value, true, true)
    setExpressProgressStage('sync')
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      applyCommitFailureFromResponse(res)
      throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    }
    lint.value = res.data.lint
    if (!res.data.committed) {
      const blocking = res.data.lint?.blockingCount ?? 0
      showToast(
        'error',
        blocking > 0
          ? t('knowledge.ingest.lintBlocked', { count: blocking })
          : t('knowledge.ingest.expressPublishBlocked'),
      )
      return
    }
    showToast(
      'success',
      t('knowledge.ingest.commitSuccess', {
        created: res.data.commit?.created ?? res.data.approvedCount,
        updated: res.data.commit?.updated ?? 0,
      }),
    )
    if (res.data.commit?.syncTriggered && res.data.commit.syncResult?.success) {
      showToast('success', t('knowledge.ingest.syncTriggered'))
    }
    workflowNextSteps.value = collectWorkflowNextSteps(res.data, res.data.commit)
    expressPublishSummary.value = {
      created: res.data.commit?.created ?? res.data.approvedCount ?? 0,
      updated: res.data.commit?.updated ?? 0,
      syncOk: res.data.commit?.syncTriggered ? res.data.commit.syncResult?.success : undefined,
    }
    expressPublishCompleted.value = true
    expressProgressStage.value = 'sync'
    expressProgressPercent.value = 100
    await loadJob()
    finishExpressProgress()
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('knowledge.ingest.opFailed')
    if (!commitErrorMessage.value) commitErrorMessage.value = msg
    resetExpressProgress()
    showToast('error', msg)
  } finally {
    publishingExpress.value = false
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
    message: buildCommitConfirmMessage(),
    confirmText: t('knowledge.ingest.commit'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  committing.value = true
  clearCommitError()
  try {
    const res = await commitKbIngestApi(jobId.value, sync)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      applyCommitFailureFromResponse(res)
      throw new Error(res.msg || t('knowledge.ingest.opFailed'))
    }
    showToast('success', t('knowledge.ingest.commitSuccess', { created: res.data.created, updated: res.data.updated }))
    if (res.data.syncTriggered) {
      if (res.data.syncResult?.success) showToast('success', t('knowledge.ingest.syncTriggered'))
      else showToast('error', res.data.syncResult?.outputTail || 'Sync')
    }
    workflowNextSteps.value = collectWorkflowNextSteps(res.data)
    await loadJob()
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('knowledge.ingest.opFailed')
    if (!commitErrorMessage.value) commitErrorMessage.value = msg
    showToast('error', msg)
  } finally {
    committing.value = false
  }
}

function backToList() {
  void router.push({ path: '/knowledge/ingest' })
}

function goWikiGovernFromJob() {
  if (!job.value?.spaceId) return
  void router.push({
    path: '/knowledge/wiki-govern/index',
    query: { spaceId: String(job.value.spaceId) },
  })
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

watch(planText, () => {
  if (syncingPlan.value || planJsonAdvanced.value) return
  syncRowsFromPlanText()
})

watch(planCreateRows, () => {
  if (syncingPlan.value || planJsonAdvanced.value) return
  applyRowsToPlanText()
}, { deep: true })

watch(jobId, (id) => {
  job.value = null
  drafts.value = []
  activeSlug.value = ''
  lint.value = null
  workflowNextSteps.value = []
  expressPublishSummary.value = null
  expressPublishCompleted.value = false
  resetExpressProgress()
  clearCommitError()
  planText.value = ''
  planCreateRows.value = []
  planJsonAdvanced.value = false
  categoryTree.value = []
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

onUnmounted(() => {
  stopExpressProgressCreep()
})
</script>

<template>
  <div class="page-stack">
    <!-- ===================== 列表 / 新建 ===================== -->
    <template v-if="!jobId">
      <div class="card p-5">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('knowledge.ingest.pageTitle') }}</h2>
          <KbSpaceDropdown v-model="ingestSpaceCode" hide-all-option />
        </div>
        <p class="mt-1 text-xs text-gray-400">{{ t('knowledge.ingest.subtitle') }}</p>
        <p v-if="!editableSpaces.length" class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {{ t('knowledge.ingest.noEditableSpace') }}
        </p>
        <p v-else-if="!canEdit" class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {{ t('knowledge.ingest.readOnlyHint') }}
        </p>
      </div>

      <KbImportDecisionHint />

      <div class="card p-4">
        <SegmentControl v-model="importEntryTab" :options="importTabOptions" />
      </div>

      <KbRawUploadPanel
        v-if="importEntryTab === 'raw'"
        :space-id="selectedSpaceQueryId"
        :can-upload="canRawUpload"
        :blocked-reason="rawUploadBlockedReason"
        @switch-tab="onRawUploadSwitchTab"
      />

      <KbWikiImportPanel
        v-else-if="importEntryTab === 'wiki'"
        :space-id="selectedSpaceQueryId"
        :space-code="ingestSpaceCode"
        :can-import="canWikiImport"
        :can-sync="canSyncTrigger"
      />

      <template v-else>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card flex flex-col p-5">
          <h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.newBatch') }}</h3>
          <div class="grid gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.topic') }}</span>
              <input v-model="formTopic" type="text" class="field-input" :placeholder="t('knowledge.ingest.topicPlaceholder')" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.batchNo') }}</span>
              <input v-model="formBatchNo" type="text" class="field-input" :placeholder="t('knowledge.ingest.batchNoPlaceholder')" />
            </label>
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
          <div class="mt-2 flex h-[min(45vh,22rem)] flex-col rounded-lg border border-gray-100 dark:border-white/5">
            <p v-if="rawLoading || rawCoverageLoading" class="p-3 text-xs text-gray-400">{{ t('common.loading') }}</p>
            <p v-else-if="!filteredRawFlatTree.length" class="p-3 text-xs text-gray-400">{{ t('knowledge.ingest.rawTreeEmpty') }}</p>
            <IngestRawTreeList
              v-else
              class="min-h-0 flex-1"
              :items="filteredRawFlatTree"
              :selected="selectedRaw"
              :highlighted="highlightedRawPaths"
              :is-dir-expanded="isRawDirExpanded"
              :coverage-for-path="coverageForPath"
              :coverage-badge-class="rawCoverageBadgeClass"
              :coverage-badge-label="rawCoverageBadgeLabel"
              :coverage-title="rawCoverageTitle"
              @toggle-file="toggleRaw"
              @toggle-dir="toggleRawDir"
            />
          </div>

          <div class="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-white/5">
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="btn-primary text-sm"
                :disabled="Boolean(createDisabledReason) || expressStarting || creating"
                :title="createDisabledReason || t('knowledge.ingest.expressPreviewHint')"
                @click="expressIngest"
              >
                <Loader2 v-if="expressStarting" class="h-4 w-4 animate-spin" />
                <Zap v-else class="h-4 w-4" />
                {{ expressStarting ? t('knowledge.ingest.expressPreviewStarting') : t('knowledge.ingest.expressPreview') }}
              </button>
              <button
                type="button"
                class="btn-ghost border border-gray-200 text-sm dark:border-white/10"
                :disabled="Boolean(createDisabledReason) || expressStarting || creating"
                :title="createDisabledReason || undefined"
                @click="createJob"
              >
                <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
                {{ creating ? t('knowledge.ingest.creating') : t('knowledge.ingest.create') }}
              </button>
            </div>

            <div class="flex flex-wrap gap-2">
              <AppCheckbox v-model="expressSkeletonPlan" variant="option">
                {{ t('knowledge.ingest.expressSkeletonPlan') }}
              </AppCheckbox>
              <AppCheckbox v-model="templateMode" variant="option">
                {{ t('knowledge.ingest.expressTemplateMode') }}
              </AppCheckbox>
            </div>

            <IngestExpressProgressPanel
              :active="expressProgressActive"
              :stage="expressProgressStage"
              :percent="expressProgressPercent"
              :template-mode="templateMode"
            />

            <p v-if="createDisabledReason" class="text-xs text-amber-700 dark:text-amber-300">{{ createDisabledReason }}</p>
          </div>
        </div>

        <!-- 历史批次 -->
        <div class="card flex flex-col p-5">
          <h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.history') }}</h3>
          <p v-if="jobsLoading" class="text-xs text-gray-400">{{ t('common.loading') }}</p>
          <p v-else-if="!jobs.length" class="text-xs text-gray-400">{{ t('knowledge.ingest.noJobs') }}</p>
          <ul v-else class="flex max-h-[min(45vh,22rem)] flex-col gap-2 overflow-y-auto">
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
              <div class="flex shrink-0 items-center gap-1.5">
                <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ statusLabel(j.status) }}</span>
                <button
                  v-if="canEdit"
                  type="button"
                  class="btn-ghost p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  :disabled="deletingJobId === toEntityId(j.id)"
                  :title="t('knowledge.ingest.deleteJob')"
                  @click="removeJob(j, $event)"
                >
                  <Loader2 v-if="deletingJobId === toEntityId(j.id)" class="h-3.5 w-3.5 animate-spin" />
                  <Trash2 v-else class="h-3.5 w-3.5" />
                </button>
              </div>
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
            <div class="flex shrink-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                class="btn-ghost shrink-0 text-xs"
                :disabled="creatingFromTemplate || !canEdit"
                @click="createJobFromTemplate(tpl)"
              >
                <Loader2 v-if="creatingFromTemplate" class="h-3.5 w-3.5 animate-spin" />
                {{ t('knowledge.ingest.fromTemplate') }}
              </button>
              <button
                v-if="canEdit"
                type="button"
                class="btn-ghost p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                :disabled="deletingTemplateId === toEntityId(tpl.id)"
                :title="t('knowledge.ingest.deleteTemplate')"
                @click="removeTemplate(tpl)"
              >
                <Loader2 v-if="deletingTemplateId === toEntityId(tpl.id)" class="h-3.5 w-3.5 animate-spin" />
                <Trash2 v-else class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </div>
      </template>
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
              <span v-if="jobSpaceLabel" class="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{{ jobSpaceLabel }}</span>
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
          <button
            v-if="jobCanEdit && job"
            type="button"
            class="btn-ghost shrink-0 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            :disabled="Boolean(deletingJobId)"
            @click="removeJob(job)"
          >
            <Loader2 v-if="deletingJobId === toEntityId(job.id)" class="mr-1 h-4 w-4 animate-spin" />
            <Trash2 v-else class="mr-1 h-4 w-4" />
            {{ t('knowledge.ingest.deleteJob') }}
          </button>
        </div>
        <p v-if="job && !jobCanEdit" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {{ t('knowledge.ingest.readOnlyHint') }}
        </p>
      </div>

      <div
        v-if="expressMode"
        class="card border-brand-200 bg-brand-50/50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.ingest.expressBannerTitle') }}</p>
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {{ job?.status === 'committed'
                ? t('knowledge.ingest.expressDoneHint')
                : expressPipelineBusy
                  ? t('knowledge.ingest.expressProcessing')
                  : t('knowledge.ingest.expressBannerHint') }}
            </p>
            <ul
              v-if="expressTargetPaths.length"
              class="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-brand-100 bg-white/70 px-3 py-2 font-mono text-[11px] text-gray-700 dark:border-brand-500/20 dark:bg-black/20 dark:text-gray-200"
            >
              <li v-for="(p, i) in expressTargetPaths" :key="`${i}-${p}`">{{ p }}</li>
            </ul>
            <p v-else-if="!expressPipelineBusy && job?.status !== 'committed'" class="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {{ t('knowledge.ingest.expressNoDrafts') }}
            </p>
          </div>
          <div v-if="jobCanEdit && job?.status !== 'committed'" class="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              class="btn-primary text-sm"
              :disabled="!canPublishExpress || publishingExpress || expressPipelineBusy"
              @click="publishExpress"
            >
              <Loader2 v-if="publishingExpress" class="h-4 w-4 animate-spin" />
              <Upload v-else class="h-4 w-4" />
              {{ publishingExpress ? t('knowledge.ingest.expressPublishing') : t('knowledge.ingest.expressPublish') }}
            </button>
            <button type="button" class="btn-ghost text-xs" @click="openExpertReview">
              {{ t('knowledge.ingest.expressExpertLink') }}
            </button>
          </div>
          <div v-else-if="job?.status === 'committed'" class="flex shrink-0 flex-col gap-2 sm:min-w-[9rem]">
            <button type="button" class="btn-primary pointer-events-none text-sm opacity-90" disabled>
              <CheckCircle2 class="h-4 w-4" />
              {{ t('knowledge.ingest.expressPublishedBadge') }}
            </button>
            <button type="button" class="btn-ghost text-sm" @click="backToList">
              {{ t('knowledge.ingest.backToList') }}
            </button>
            <button type="button" class="btn-ghost text-xs" @click="openExpertReview">
              {{ t('knowledge.ingest.expressViewCommitted') }}
            </button>
          </div>
        </div>
        <IngestExpressProgressPanel
          class="mt-3"
          :active="expressProgressActive || expressPublishCompleted"
          :completed="expressPublishCompleted || job?.status === 'committed'"
          :stage="expressProgressStage ?? (expressPublishCompleted || job?.status === 'committed' ? 'sync' : null)"
          :percent="expressPublishCompleted || job?.status === 'committed' ? 100 : expressProgressPercent"
          :template-mode="templateMode"
        />
        <div
          v-if="job?.status === 'committed'"
          class="mt-4 space-y-3 border-t border-brand-200/70 pt-4 dark:border-brand-500/20"
        >
          <p class="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {{
              expressPublishSummary
                ? t('knowledge.ingest.expressDoneDetail', expressPublishSummary)
                : t('knowledge.ingest.expressDoneHint')
            }}
          </p>
          <p v-if="expressPublishSummary?.syncOk" class="text-xs text-emerald-700 dark:text-emerald-400">
            {{ t('knowledge.ingest.syncTriggered') }}
          </p>
          <KbWorkflowNextSteps v-if="workflowNextSteps.length" :steps="workflowNextSteps" />
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-if="job?.spaceId"
              type="button"
              class="btn-ghost border border-brand-200 text-sm dark:border-brand-500/30"
              @click="goWikiGovernFromJob"
            >
              {{ t('knowledge.ingest.expressFallbackGovern') }}
            </button>
            <button type="button" class="btn-ghost border border-gray-200 text-sm dark:border-white/10" @click="backToList">
              {{ t('knowledge.ingest.expressFallbackNewBatch') }}
            </button>
          </div>
        </div>
        <div
          v-if="(commitErrorMessage || commitErrorConflicts.length) && job?.status !== 'committed'"
          class="mt-3 rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-3 dark:border-rose-500/30 dark:bg-rose-500/10"
        >
          <p class="text-sm font-semibold text-rose-800 dark:text-rose-200">{{ t('knowledge.ingest.commitErrorTitle') }}</p>
          <p class="mt-1 text-xs text-rose-700 dark:text-rose-300">
            {{ commitErrorIsCluster ? t('knowledge.ingest.rawCoverageBlocked') : t('knowledge.ingest.commitErrorHint') }}
          </p>
          <div
            v-if="commitErrorConflicts.length"
            class="mt-2 overflow-x-auto rounded border border-rose-200/80 dark:border-rose-500/30"
          >
            <table class="w-full min-w-[20rem] text-left text-[11px]">
              <thead class="bg-rose-100/60 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
                <tr>
                  <th class="px-2 py-1.5 font-medium">{{ t('knowledge.ingest.commitConflictPath') }}</th>
                  <th class="px-2 py-1.5 font-medium">{{ t('knowledge.ingest.commitConflictWikiSlugs') }}</th>
                  <th class="px-2 py-1.5 font-medium">{{ t('knowledge.ingest.commitConflictCoverage') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(c, i) in commitErrorConflicts"
                  :key="`${c.path ?? i}-${i}`"
                  class="border-t border-rose-100 dark:border-rose-500/20"
                >
                  <td class="whitespace-pre-wrap break-all px-2 py-1 font-mono text-rose-900 dark:text-rose-100">{{ c.path ?? '—' }}</td>
                  <td class="whitespace-pre-wrap break-all px-2 py-1 text-rose-900 dark:text-rose-100">{{ c.wikiSlugs?.join(', ') ?? '—' }}</td>
                  <td class="whitespace-pre-wrap break-all px-2 py-1 text-rose-900 dark:text-rose-100">{{ c.coverage ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre
            v-if="commitErrorMessage"
            class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-rose-900 dark:text-rose-100"
          >{{ commitErrorMessage }}</pre>
        </div>
        <p
          v-if="expressPipelineBusy && !expressProgressActive && job?.status !== 'committed'"
          class="mt-3 flex items-center gap-2 text-xs text-brand-700 dark:text-brand-300"
        >
          <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ t('knowledge.ingest.expressProcessing') }}
        </p>
      </div>

      <!-- ① Plan（Expert 逐步审阅） -->
      <div v-if="!expressMode" class="card flex flex-col p-5">
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

        <div v-if="!planJsonAdvanced" class="mt-3">
          <IngestPlanCreateTable
            v-if="planCreateRows.length"
            v-model="planCreateRows"
            :category-options="categoryOptions"
            :category-tree="categoryTree"
            :categories-loading="categoriesLoading"
            :space-code="job?.spaceCode"
            :readonly="!jobCanEdit"
          />
          <p v-else-if="planText.trim()" class="text-xs text-gray-400">{{ t('knowledge.ingest.planCreateEmpty') }}</p>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn-ghost text-xs"
            @click="togglePlanJsonAdvanced"
          >
            {{ planJsonAdvanced ? t('knowledge.ingest.planVisualMode') : t('knowledge.ingest.planJsonAdvanced') }}
          </button>
        </div>

        <textarea
          v-show="planJsonAdvanced"
          v-model="planText"
          class="field-input kb-ingest-plan-editor mt-3"
          :placeholder="t('knowledge.ingest.planEditorPlaceholder')"
          spellcheck="false"
          :readonly="!jobCanEdit"
        />
        <div v-if="conflicts.length" class="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <p class="mb-1 font-medium">{{ t('knowledge.ingest.conflictsTitle') }}</p>
          <ul class="list-disc pl-4">
            <li v-for="(c, i) in conflicts" :key="i">{{ c }}</li>
          </ul>
        </div>
      </div>

      <!-- ② Drafts + diff（Expert 逐步审阅） -->
      <div v-if="!expressMode" class="card p-5">
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

        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <AppCheckbox v-model="templateMode" variant="option" :disabled="!jobCanEdit">
            {{ t('knowledge.ingest.templateMode') }}
          </AppCheckbox>
          <p v-if="templateMode" class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.templateModeHint') }}</p>
          <p v-if="templateModeActive" class="text-xs font-medium text-amber-700 dark:text-amber-300">
            {{ t('knowledge.ingest.templateModeActive') }}
          </p>
        </div>

        <p v-if="generateDraftsHint" class="mt-2 rounded-md bg-amber-50/90 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {{ generateDraftsHint }}
        </p>
        <p v-else-if="resumeGenerateHint && !drafts.length" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ resumeGenerateHint }}
        </p>

        <p v-if="lastGenerateStats" class="mt-2 text-xs text-gray-400">
          {{ t('knowledge.ingest.generateProgress', lastGenerateStats) }}
          <span v-if="generateLiveSlug" class="ml-1 text-brand-600 dark:text-brand-300">
            {{ t('knowledge.ingest.generateLive', { slug: generateLiveSlug }) }}
          </span>
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
                <span class="truncate font-medium text-gray-800 dark:text-gray-100" :title="draftPathTooltip(d)">{{ d.displaySlug }}</span>
                <span class="badge shrink-0" :class="approvalBadgeClass(d.approval)">{{ approvalLabel(d.approval) }}</span>
              </div>
              <p class="mt-0.5 truncate text-gray-400" :title="d.slug">
                {{ d.action === 'enrich' ? t('knowledge.ingest.enrichLabel') : t('knowledge.ingest.createLabel') }}
                <span v-if="d.categoryName"> · {{ d.categoryName }}</span>
                <span v-else-if="d.dirSlug"> · {{ d.dirSlug }}/</span>
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

      <!-- ③ Lint + commit（Expert 逐步审阅） -->
      <div v-if="!expressMode && drafts.length" class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.lintSection') }}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn-ghost text-sm" :disabled="linting" @click="runLint">
              <Loader2 v-if="linting" class="h-4 w-4 animate-spin" />
              {{ t('knowledge.ingest.runLint') }}
            </button>
            <button
              v-if="expressMode && canPublishExpress"
              type="button"
              class="btn-primary text-sm"
              :disabled="publishingExpress"
              @click="publishExpress"
            >
              <Loader2 v-if="publishingExpress" class="h-4 w-4 animate-spin" />
              <Upload v-else class="h-4 w-4" />
              {{ t('knowledge.ingest.expressPublish') }}
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

        <div
          v-if="commitErrorMessage || commitErrorConflicts.length"
          class="mt-3 rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-3 dark:border-rose-500/30 dark:bg-rose-500/10"
        >
          <p class="text-sm font-semibold text-rose-800 dark:text-rose-200">{{ t('knowledge.ingest.commitErrorTitle') }}</p>
          <p class="mt-1 text-xs text-rose-700 dark:text-rose-300">
            {{ commitErrorIsCluster ? t('knowledge.ingest.rawCoverageBlocked') : t('knowledge.ingest.commitErrorHint') }}
          </p>
          <div
            v-if="commitErrorConflicts.length"
            class="mt-2 overflow-x-auto rounded border border-rose-200/80 dark:border-rose-500/30"
          >
            <table class="w-full min-w-[20rem] text-left text-[11px]">
              <thead class="bg-rose-100/60 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
                <tr>
                  <th class="px-2 py-1.5 font-medium">{{ t('knowledge.ingest.commitConflictPath') }}</th>
                  <th class="px-2 py-1.5 font-medium">{{ t('knowledge.ingest.commitConflictWikiSlugs') }}</th>
                  <th class="px-2 py-1.5 font-medium">{{ t('knowledge.ingest.commitConflictCoverage') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(c, i) in commitErrorConflicts"
                  :key="`${c.path ?? i}-${i}`"
                  class="border-t border-rose-100 dark:border-rose-500/20"
                >
                  <td class="whitespace-pre-wrap break-all px-2 py-1 font-mono text-rose-900 dark:text-rose-100">{{ c.path ?? '—' }}</td>
                  <td class="whitespace-pre-wrap break-all px-2 py-1 text-rose-900 dark:text-rose-100">{{ c.wikiSlugs?.join(', ') ?? '—' }}</td>
                  <td class="whitespace-pre-wrap break-all px-2 py-1 text-rose-900 dark:text-rose-100">{{ c.coverage ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre
            v-if="commitErrorMessage"
            class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-rose-900 dark:text-rose-100"
          >{{ commitErrorMessage }}</pre>
        </div>

        <KbWorkflowNextSteps v-if="workflowNextSteps.length" class="mt-3" :steps="workflowNextSteps" />

        <div
          v-if="approvedCommitPaths.length"
          class="mt-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-white/5 dark:bg-white/[0.02]"
        >
          <p class="text-xs font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.ingest.commitPreviewTitle') }}</p>
          <p class="mt-0.5 text-xs text-gray-400">{{ t('knowledge.ingest.commitPreviewHint', { root: wikiRootDir }) }}</p>
          <ul class="mt-2 flex flex-col gap-1">
            <li
              v-for="item in approvedCommitPaths"
              :key="item.slug"
              class="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px]"
            >
              <code class="rounded bg-white px-1.5 py-0.5 text-brand-700 dark:bg-white/5 dark:text-brand-300">{{ item.path }}</code>
              <span class="text-gray-400">
                {{ item.action === 'enrich' ? t('knowledge.ingest.enrichLabel') : t('knowledge.ingest.createLabel') }}
                · {{ item.displaySlug }}
              </span>
            </li>
          </ul>
        </div>

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
      wide
      @close="saveTemplateOpen = false"
    >
      <form class="form-modal" novalidate @submit.prevent="submitSaveTemplate">
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.ingest.saveAsTemplateDesc') }}</p>
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField
              :label="t('knowledge.ingest.saveAsTemplatePrompt')"
              horizontal
              required
              class="form-field-span-2"
              :hint="job?.planVersion ? t('knowledge.ingest.saveAsTemplateIncludePlan') : undefined"
            >
              <input
                v-model="saveTemplateName"
                type="text"
                class="field-input"
                :placeholder="t('knowledge.ingest.saveAsTemplatePlaceholder')"
              />
            </FormField>
          </div>
        </div>
      </form>
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
