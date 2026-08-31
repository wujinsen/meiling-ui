<script setup lang="ts">
import { computed, onErrorCaptured, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Activity,
  AlertTriangle,
  Bot,
  ExternalLink,
  GitCompare,
  Link2Off,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-vue-next'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import KbOpsCostTrendChart from '@/components/knowledge/KbOpsCostTrendChart.vue'
import KbOpsEvalTrendChart from '@/components/knowledge/KbOpsEvalTrendChart.vue'
import KbOpsSyncTrendChart from '@/components/knowledge/KbOpsSyncTrendChart.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { getKbLintIssuesApi, getKbLlmConfigApi, getKbOpsDashboardApi, getKbOpsEvalRunsApi, getKbOpsEvalTrendApi, getKbSyncDriftApi, getKbSyncLogsApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  KbLlmConfig,
  KbOpsDashboardVo,
  KbOpsDriftSummary,
  KbOpsEvalRun,
  KbOpsEvalSummary,
  KbOpsEvalTrendPoint,
  KbOpsLlmSummary,
} from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import {
  aggregatePendingIssues,
  aggregateSyncTrendByDay,
  aggregateDriftReports,
  applyKbOpsDashboardVo,
  driftSpaceSamples,
  driftScanFailureDetail,
  formatDayLabel,
  formatDeltaHit,
  formatHitPct,
  formatMrr,
  formatUsd,
  hasLlmCallLogMetrics,
  hasRetrievalEvalData,
  resolveDriftPageTotals,
  toNumberOrNull,
  topBrokenLinkIssues,
  type KbBrokenLinkRow,
  type KbPendingIssueBucket,
  type KbSyncTrendDay,
} from '@/utils/kbOpsDashboard'
import { kbGraphRoute, kbLintRoute, kbLlmSettingsRoute, kbWikiGovernRoute } from '@/utils/kbWorkflowRoutes'

const { t, locale } = useI18n()
const router = useRouter()
const { spaces, ensureSpacesLoaded } = useKbSpace()

const canView = computed(() => assertAction(PERM.KB_OPS_DASHBOARD))

const loading = ref(false)
let loadGen = 0
const syncTrend = ref<KbSyncTrendDay[]>([])
const pendingBuckets = ref<KbPendingIssueBucket[]>([])
const brokenTop = ref<KbBrokenLinkRow[]>([])
const llmConfig = ref<KbLlmConfig | null>(null)
const llmOps = ref<KbOpsLlmSummary | null>(null)
const retrievalQuality = ref<KbOpsEvalSummary | null>(null)
const driftSummary = ref<KbOpsDriftSummary | null>(null)
const driftSummaryLoaded = ref(false)
const driftLoading = ref(false)
const driftFallbackError = ref('')
const unresolvedRelationCount = ref(0)
const syncLogTotal = ref(0)
const dashboardSource = ref<'api' | 'legacy'>('api')
const renderError = ref('')

const evalDrawerOpen = ref(false)
const evalDrawerStrategy = ref('')
const evalRuns = ref<KbOpsEvalRun[]>([])
const evalTrend = ref<KbOpsEvalTrendPoint[]>([])
const evalLoading = ref(false)

const hasDashboardContent = computed(
  () =>
    Boolean(llmConfig.value)
    || pendingBuckets.value.length > 0
    || syncTrend.value.length > 0
    || Boolean(retrievalQuality.value)
    || Boolean(driftSummary.value),
)

const pendingTotal = computed(() => pendingBuckets.value.reduce((sum, row) => sum + row.count, 0))
const syncWeekTotal = computed(() =>
  syncTrend.value.reduce((sum, row) => sum + row.success + row.fail, 0),
)
const syncWeekFails = computed(() => syncTrend.value.reduce((sum, row) => sum + row.fail, 0))
const showLlmCost = computed(() => hasLlmCallLogMetrics(llmOps.value))
const showEvalData = computed(() => hasRetrievalEvalData(retrievalQuality.value))
const evalStrategies = computed(() => retrievalQuality.value?.strategies ?? [])
const driftSamples = computed(() => driftSpaceSamples(driftSummary.value, 5))
const driftPageTotals = computed(() => resolveDriftPageTotals(driftSummary.value))
const driftScanEmpty = computed(
  () =>
    Boolean(driftSummary.value?.scanEmpty)
    || (
      (driftSummary.value?.spacesScanned ?? 0) > 0
      && driftPageTotals.value.wiki === 0
      && driftPageTotals.value.db === 0
      && !(driftSummary.value?.scanFailedCount ?? 0)
    ),
)
const driftShowEmptyWarning = computed(() => driftScanEmpty.value && syncWeekTotal.value > 0)
const driftNoSpacesScanned = computed(
  () => driftSummaryLoaded.value && driftSummary.value != null && (driftSummary.value.spacesScanned ?? 0) === 0,
)
const driftBadgeStatus = computed<'unknown' | 'aligned' | 'drifted'>(() => {
  if (!driftSummaryLoaded.value || !driftSummary.value) return 'unknown'
  return driftSummary.value.drifted ? 'drifted' : 'aligned'
})
const localeTag = computed(() => (locale.value === 'ja' ? 'ja-JP' : locale.value === 'en' ? 'en-US' : 'zh-CN'))

const llmStatus = computed<'ok' | 'warn' | 'off'>(() => {
  const cfg = llmConfig.value
  if (!cfg) return 'off'
  if (cfg.available) return 'ok'
  if (cfg.configEnabled || cfg.apiKeyConfigured) return 'warn'
  return 'off'
})

const sceneRows = computed(() => {
  const map = llmOps.value?.callsByScene ?? {}
  return Object.entries(map).map(([scene, count]) => ({ scene, count: Number(count) || 0 }))
})

function issueTypeLabel(type: string) {
  const key = `knowledge.opsDashboard.issueTypes.${type}`
  const translated = t(key)
  return translated === key ? type : translated
}

function strategyLabel(strategy: string) {
  const key = `knowledge.opsDashboard.d5Strategy.${strategy}`
  const translated = t(key)
  return translated === key ? strategy : translated
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(localeTag.value)
}

function deltaClass(value: unknown) {
  const n = toNumberOrNull(value)
  if (n == null || n === 0) return 'text-gray-500 dark:text-gray-400'
  return n > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
}

function resetExtendedFields() {
  llmOps.value = null
  retrievalQuality.value = null
  driftSummary.value = null
  driftSummaryLoaded.value = false
  driftFallbackError.value = ''
  unresolvedRelationCount.value = 0
}

async function loadDriftFallback() {
  if (driftLoading.value || driftSummaryLoaded.value) return
  driftFallbackError.value = ''

  let spaceIds = spaces.value
    .map((s) => (s.id != null ? String(s.id) : ''))
    .filter((id) => id !== '')

  if (!spaceIds.length) {
    const logsRes = await getKbSyncLogsApi({ pageNum: 1, pageSize: 20 })
    if (logsRes.code === API_SUCCESS_CODE) {
      const ids = new Set<string>()
      for (const row of logsRes.data?.records ?? []) {
        if (row.spaceId != null && String(row.spaceId) !== '') {
          ids.add(String(row.spaceId))
        }
      }
      spaceIds = [...ids]
    }
  }

  if (!spaceIds.length) {
    driftFallbackError.value = t('knowledge.opsDashboard.d7NoSpaceIds')
    return
  }

  driftLoading.value = true
  const errors: string[] = []
  try {
    const reports = await Promise.all(
      spaceIds.slice(0, 5).map(async (spaceId) => {
        try {
          const res = await getKbSyncDriftApi(spaceId, 5)
          if (res.code === API_SUCCESS_CODE && res.data) {
            return res.data
          }
          errors.push(res.msg || `spaceId=${spaceId}`)
          return null
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e))
          return null
        }
      }),
    )
    const valid = reports.filter((row): row is NonNullable<typeof row> => row != null)
    if (valid.length) {
      driftSummary.value = aggregateDriftReports(valid)
      driftSummaryLoaded.value = true
    } else if (errors.length) {
      driftFallbackError.value = errors[0] ?? t('knowledge.opsDashboard.d7FallbackFailed')
    }
  } finally {
    driftLoading.value = false
  }
}

async function loadDashboardLegacy() {
  resetExtendedFields()
  const [llmRes, issuesRes, logsRes] = await Promise.all([
    getKbLlmConfigApi(),
    getKbLintIssuesApi({ status: 0, pageNum: 1, pageSize: 20 }),
    getKbSyncLogsApi({ pageNum: 1, pageSize: 500 }),
  ])

  if (llmRes.code === API_SUCCESS_CODE) llmConfig.value = llmRes.data ?? null

  const issues = issuesRes.code === API_SUCCESS_CODE ? issuesRes.data?.records ?? [] : []
  if (issuesRes.code !== API_SUCCESS_CODE) {
    showToast('error', issuesRes.msg || t('knowledge.opsDashboard.loadIssuesFailed'))
  }

  const logs = logsRes.code === API_SUCCESS_CODE ? logsRes.data?.records ?? [] : []
  syncLogTotal.value = logsRes.data?.total ?? logs.length
  if (logsRes.code !== API_SUCCESS_CODE) {
    showToast('error', logsRes.msg || t('knowledge.opsDashboard.loadLogsFailed'))
  }

  syncTrend.value = aggregateSyncTrendByDay(logs, 7).map((row) => ({
    ...row,
    label: formatDayLabel(row.date, localeTag.value),
  }))
  pendingBuckets.value = aggregatePendingIssues(issues, spaces.value)
  brokenTop.value = topBrokenLinkIssues(issues, spaces.value, 10)
}

function applyDashboardPayload(data: KbOpsDashboardVo) {
  const mapped = applyKbOpsDashboardVo(
    data,
    spaces.value,
    t('knowledge.opsDashboard.allSpaces'),
    localeTag.value,
  )
  dashboardSource.value = 'api'
  syncTrend.value = mapped.syncTrend.map((row) => ({
    ...row,
    label: formatDayLabel(row.date, localeTag.value),
  }))
  pendingBuckets.value = mapped.pendingBuckets
  brokenTop.value = mapped.brokenTop
  syncLogTotal.value = mapped.openCount
  retrievalQuality.value = mapped.retrievalQuality ?? { strategies: [] }
  driftSummary.value = mapped.driftSummary ?? null
  driftSummaryLoaded.value = Boolean(
    data.driftSummary
    && (
      (data.driftSummary.spacesScanned ?? 0) > 0
      || (data.driftSummary.spaces?.length ?? 0) > 0
      || data.driftSummary.checkedAt
    ),
  )
  unresolvedRelationCount.value = mapped.unresolvedRelationCount
  llmOps.value = mapped.llm ?? null
  const llm = data.llm
  llmConfig.value = {
    configEnabled: Boolean(llm?.enabled),
    available: Boolean(llm?.available),
    apiKeyConfigured: Boolean(llm?.available || llm?.enabled),
    provider: llm?.provider,
    model: llm?.model,
  }
}

async function loadDashboard() {
  if (!canView.value) {
    loading.value = false
    return
  }
  const seq = ++loadGen
  loading.value = true
  renderError.value = ''
  driftFallbackError.value = ''

  await ensureSpacesLoaded().catch(() => undefined)

  const dashPromise = getKbOpsDashboardApi({ trendDays: 7 })
  void dashPromise.catch(() => undefined)

  try {
    dashboardSource.value = 'legacy'
    await loadDashboardLegacy()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.opsDashboard.loadFailed'))
  }
  if (seq === loadGen) loading.value = false

  try {
    const dashRes = await dashPromise
    if (seq !== loadGen) return
    if (dashRes.code === API_SUCCESS_CODE && dashRes.data) {
      try {
        applyDashboardPayload(dashRes.data)
      } catch {
        showToast('error', t('knowledge.opsDashboard.loadFallbackLegacy'))
      }
    } else {
      dashboardSource.value = 'legacy'
    }
  } catch (e) {
    if (seq !== loadGen) return
    dashboardSource.value = 'legacy'
    showToast('error', e instanceof Error ? e.message : t('knowledge.opsDashboard.loadFailed'))
  }
  if (seq === loadGen && !driftSummaryLoaded.value) {
    await ensureSpacesLoaded().catch(() => undefined)
    await loadDriftFallback()
  }
}

onErrorCaptured((err) => {
  loading.value = false
  renderError.value = err instanceof Error ? err.message : String(err)
  showToast('error', renderError.value || t('knowledge.opsDashboard.loadFailed'))
  return false
})

async function openEvalHistory(strategy: string) {
  evalDrawerStrategy.value = strategy
  evalDrawerOpen.value = true
  evalLoading.value = true
  evalRuns.value = []
  evalTrend.value = []
  try {
    const [runsRes, trendRes] = await Promise.all([
      getKbOpsEvalRunsApi({ strategy, limit: 20 }),
      getKbOpsEvalTrendApi({ strategy, days: 14 }),
    ])
    if (runsRes.code === API_SUCCESS_CODE) evalRuns.value = runsRes.data ?? []
    else showToast('error', runsRes.msg || t('knowledge.opsDashboard.d5LoadRunsFailed'))
    if (trendRes.code === API_SUCCESS_CODE) evalTrend.value = trendRes.data ?? []
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.opsDashboard.d5LoadRunsFailed'))
  } finally {
    evalLoading.value = false
  }
}

function closeEvalDrawer() {
  evalDrawerOpen.value = false
}

function goLint(spaceId?: string) {
  void router.push(kbLintRoute({ spaceId: spaceId && spaceId !== '_unknown' ? spaceId : null }))
}

function goLintSync() {
  void router.push(kbLintRoute({ tab: 'sync' }))
}

function goWikiGovern(spaceId?: string | number) {
  void router.push(kbWikiGovernRoute(spaceId != null && String(spaceId) !== '_unknown' ? spaceId : null))
}

function goGraph() {
  void router.push(kbGraphRoute())
}

function goLlmSettings() {
  void router.push(kbLlmSettingsRoute())
}

onMounted(() => {
  if (!canView.value) {
    loading.value = false
    return
  }
  if (loadGen === 0) {
    void ensureSpacesLoaded().catch(() => undefined)
    void loadDashboard()
  }
})

if (canView.value) {
  void ensureSpacesLoaded().catch(() => undefined)
  void loadDashboard()
}
</script>

<template>
  <div class="page-stack">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="page-title">{{ t('knowledge.opsDashboard.title') }}</h1>
        <p class="page-subtitle">{{ t('knowledge.opsDashboard.subtitle') }}</p>
      </div>
      <button
        v-if="canView"
        type="button"
        class="btn-ghost shrink-0"
        @click="loadDashboard"
      >
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
        {{ t('common.refresh') }}
      </button>
    </header>

    <KbAccessDenied
      v-if="!canView"
      :title="t('knowledge.opsDashboard.noPermTitle')"
      :message="t('knowledge.opsDashboard.noPermMessage')"
      :hint="t('knowledge.opsDashboard.noPermHint')"
    />

    <template v-else>
      <p v-if="renderError" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {{ renderError }}
      </p>

      <p v-if="loading && !hasDashboardContent" class="card p-16 text-center text-sm text-gray-400">
        <Loader2 class="mx-auto mb-2 h-6 w-6 animate-spin" />
        {{ t('common.loading') }}
      </p>

      <template v-else>
        <div class="grid gap-4 lg:grid-cols-2">
          <!-- D1 Sync 趋势 -->
          <section class="card p-5 lg:col-span-2">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Activity class="h-5 w-5 text-indigo-500" />
                <div>
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.opsDashboard.d1Title') }}</h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.d1Hint') }}</p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{{ t('knowledge.opsDashboard.weekActions', { count: syncWeekTotal }) }}</span>
                <span v-if="syncWeekFails" class="text-rose-600 dark:text-rose-400">
                  {{ t('knowledge.opsDashboard.weekFails', { count: syncWeekFails }) }}
                </span>
                <button type="button" class="btn-ghost !px-2 !py-1 text-xs" @click="goLintSync">
                  {{ t('knowledge.opsDashboard.openSync') }}
                  <ExternalLink class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <KbOpsSyncTrendChart v-if="syncWeekTotal > 0" :days="syncTrend" />
            <p v-else class="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              {{ t('knowledge.opsDashboard.syncEmpty') }}
            </p>
            <p v-if="dashboardSource === 'legacy' && syncLogTotal > 500" class="mt-2 text-xs text-gray-400">
              {{ t('knowledge.opsDashboard.logTruncated', { total: syncLogTotal }) }}
            </p>
          </section>

          <!-- D3 LLM 可用 + D6 成本 -->
          <section class="card p-5">
            <div class="mb-4 flex items-center gap-2">
              <Bot class="h-5 w-5 text-violet-500" />
              <div>
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.opsDashboard.d3Title') }}</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.d3Hint') }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span
                class="inline-flex h-3 w-3 rounded-full"
                :class="{
                  'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]': llmStatus === 'ok',
                  'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.2)]': llmStatus === 'warn',
                  'bg-gray-300 dark:bg-gray-600': llmStatus === 'off',
                }"
                :title="t(`knowledge.opsDashboard.llmStatus.${llmStatus}`)"
              />
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ t(`knowledge.opsDashboard.llmStatus.${llmStatus}`) }}
                </p>
                <p v-if="llmConfig?.provider" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ llmConfig.provider }} · {{ llmConfig.model || '-' }}
                </p>
              </div>
            </div>
            <ul class="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <li>
                {{
                  llmConfig?.configEnabled
                    ? t('knowledge.opsDashboard.llmEnabledOn')
                    : t('knowledge.opsDashboard.llmEnabledOff')
                }}
              </li>
              <li>
                {{
                  llmConfig?.apiKeyConfigured
                    ? t('knowledge.opsDashboard.llmKeyOn')
                    : t('knowledge.opsDashboard.llmKeyOff')
                }}
              </li>
            </ul>

            <div class="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 class="text-xs font-semibold text-gray-800 dark:text-gray-200">{{ t('knowledge.opsDashboard.d6Title') }}</h3>
              <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.d6Hint') }}</p>
              <template v-if="showLlmCost">
                <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div class="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/50">
                    <dt class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d6Total') }}</dt>
                    <dd class="text-sm font-semibold text-gray-900 dark:text-white">{{ llmOps?.totalCalls ?? 0 }}</dd>
                  </div>
                  <div class="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/50">
                    <dt class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d6Success') }}</dt>
                    <dd class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{{ llmOps?.successCalls ?? 0 }}</dd>
                  </div>
                  <div class="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/50">
                    <dt class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d6Fail') }}</dt>
                    <dd class="text-sm font-semibold text-rose-600 dark:text-rose-400">{{ llmOps?.failCalls ?? 0 }}</dd>
                  </div>
                </dl>
                <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {{ t('knowledge.opsDashboard.d6SuccessRate') }}
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatHitPct(llmOps?.successRate) }}</span>
                  · {{ t('knowledge.opsDashboard.d6CacheHit') }}
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatHitPct(llmOps?.cacheHitRate) }}</span>
                </p>
                <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {{ t('knowledge.opsDashboard.d6Cost') }}
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatUsd(llmOps?.estimatedCostUsd) }}</span>
                  · {{ t('knowledge.opsDashboard.d6Saved') }}
                  <span class="font-medium text-emerald-600 dark:text-emerald-400">{{ formatUsd(llmOps?.estimatedCostSavedUsd) }}</span>
                </p>
                <div v-if="sceneRows.length" class="mt-3 flex flex-wrap gap-1.5">
                  <span
                    v-for="row in sceneRows"
                    :key="row.scene"
                    class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                  >
                    {{ row.scene }} · {{ row.count }}
                  </span>
                </div>
                <KbOpsCostTrendChart
                  v-if="llmOps?.costTrend?.length"
                  class="mt-3"
                  :points="llmOps.costTrend"
                  :locale-tag="localeTag"
                />
              </template>
              <p v-else class="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                {{ t('knowledge.opsDashboard.d6Disabled') }}
              </p>
            </div>

            <button type="button" class="btn-ghost mt-4 !px-2 !py-1 text-xs" @click="goLlmSettings">
              {{ t('knowledge.opsDashboard.openLlm') }}
              <ExternalLink class="h-3.5 w-3.5" />
            </button>
          </section>

          <!-- D2 待处理工单摘要 -->
          <section class="card p-5">
            <div class="mb-4 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <AlertTriangle class="h-5 w-5 text-amber-500" />
                <div>
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.opsDashboard.d2Title') }}</h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.d2Hint') }}</p>
                </div>
              </div>
              <span class="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                {{ pendingTotal }}
              </span>
            </div>
            <div v-if="pendingBuckets.length" class="max-h-56 overflow-y-auto">
              <table class="w-full text-left text-xs">
                <thead class="sticky top-0 bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th class="pb-2 pr-2 font-medium">{{ t('knowledge.opsDashboard.colSpace') }}</th>
                    <th class="pb-2 pr-2 font-medium">{{ t('knowledge.opsDashboard.colType') }}</th>
                    <th class="pb-2 text-right font-medium">{{ t('knowledge.opsDashboard.colCount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in pendingBuckets.slice(0, 12)"
                    :key="`${row.spaceId}-${row.issueType}`"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 pr-2 text-gray-800 dark:text-gray-200">{{ row.spaceName }}</td>
                    <td class="py-2 pr-2 text-gray-600 dark:text-gray-400">{{ issueTypeLabel(row.issueType) }}</td>
                    <td class="py-2 text-right font-medium text-gray-900 dark:text-white">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.pendingEmpty') }}</p>
            <button type="button" class="btn-ghost mt-4 !px-2 !py-1 text-xs" @click="goLint()">
              {{ t('knowledge.opsDashboard.openLint') }}
              <ExternalLink class="h-3.5 w-3.5" />
            </button>
          </section>

          <!-- D4 断链 Top N -->
          <section class="card p-5 lg:col-span-2">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Link2Off class="h-5 w-5 text-rose-500" />
                <div>
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.opsDashboard.d4Title') }}</h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.d4Hint') }}</p>
                </div>
              </div>
              <button type="button" class="btn-ghost !px-2 !py-1 text-xs" @click="goWikiGovern()">
                {{ t('knowledge.opsDashboard.openGovern') }}
                <ExternalLink class="h-3.5 w-3.5" />
              </button>
            </div>
            <div v-if="brokenTop.length" class="overflow-x-auto">
              <table class="w-full min-w-[480px] text-left text-xs">
                <thead class="text-gray-500 dark:text-gray-400">
                  <tr>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.colSpace') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.colDetail') }}</th>
                    <th class="pb-2 text-right font-medium">{{ t('knowledge.opsDashboard.colCount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in brokenTop"
                    :key="row.key"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 pr-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{{ row.spaceName }}</td>
                    <td class="py-2 pr-3 text-gray-600 dark:text-gray-400">{{ row.detail }}</td>
                    <td class="py-2 text-right font-medium text-gray-900 dark:text-white">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.brokenEmpty') }}</p>
          </section>

          <!-- D5 检索质量 -->
          <section class="card p-5 lg:col-span-2">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Search class="h-5 w-5 text-sky-500" />
                <div>
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.opsDashboard.d5Title') }}</h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.opsDashboard.d5Hint') }}</p>
                </div>
              </div>
              <span v-if="retrievalQuality?.goldenTotal" class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('knowledge.opsDashboard.d5Golden', { count: retrievalQuality.goldenTotal }) }}
              </span>
            </div>
            <div v-if="showEvalData" class="overflow-x-auto">
              <table class="w-full min-w-[640px] text-left text-xs">
                <thead class="text-gray-500 dark:text-gray-400">
                  <tr>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5ColStrategy') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Hit3') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Mrr') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Baseline') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Delta') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Gate') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5RunAt') }}</th>
                    <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Errors') }}</th>
                    <th class="pb-2 text-right font-medium">{{ t('knowledge.opsDashboard.d5Actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in evalStrategies"
                    :key="row.strategy"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 pr-3 font-medium text-gray-900 dark:text-white">{{ strategyLabel(row.strategy) }}</td>
                    <td class="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-200">{{ formatHitPct(row.hit3) }}</td>
                    <td class="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-200">{{ formatMrr(row.mrr) }}</td>
                    <td class="py-2 pr-3 tabular-nums text-gray-500">{{ formatHitPct(row.baselineHit3) }}</td>
                    <td class="py-2 pr-3 tabular-nums font-medium" :class="deltaClass(row.deltaHit3)">{{ formatDeltaHit(row.deltaHit3) }}</td>
                    <td class="py-2 pr-3">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                        :class="row.gatePass ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'"
                      >
                        {{ row.gatePass ? t('knowledge.opsDashboard.d5GatePass') : t('knowledge.opsDashboard.d5GateFail') }}
                      </span>
                    </td>
                    <td class="py-2 pr-3 whitespace-nowrap text-gray-500">{{ formatDateTime(row.latestRunAt) }}</td>
                    <td class="py-2 pr-3 tabular-nums" :class="(row.errors ?? 0) > 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400'">
                      {{ row.errors ?? 0 }}
                      <span v-if="row.p95Ms != null" class="ml-1 text-[11px] text-gray-400">p95 {{ row.p95Ms }}ms</span>
                    </td>
                    <td class="py-2 text-right">
                      <button type="button" class="btn-ghost !px-2 !py-1 text-xs" @click="openEvalHistory(row.strategy)">
                        {{ t('knowledge.opsDashboard.d5ViewHistory') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              {{ t('knowledge.opsDashboard.d5Empty') }}
            </p>
          </section>

          <!-- D7 Wiki↔DB 漂移 -->
          <section class="card p-5 lg:col-span-2">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <GitCompare class="h-5 w-5 text-teal-500" />
                <div>
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.opsDashboard.d7Title') }}</h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ t('knowledge.opsDashboard.d7HintUser') }}
                    <span v-if="driftSummaryLoaded && driftSummary">
                      · {{ t('knowledge.opsDashboard.d7Spaces', { drifted: driftSummary.spacesWithDrift ?? 0, scanned: driftSummary.spacesScanned ?? 0 }) }}
                      · {{ t('knowledge.opsDashboard.d7PageTotals', { wiki: driftPageTotals.wiki, db: driftPageTotals.db }) }}
                    </span>
                  </p>
                </div>
              </div>
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="{
                  'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300': driftBadgeStatus === 'unknown',
                  'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300': driftBadgeStatus === 'drifted',
                  'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300': driftBadgeStatus === 'aligned',
                }"
              >
                {{
                  driftLoading
                    ? t('knowledge.opsDashboard.d7Loading')
                    : driftBadgeStatus === 'unknown'
                      ? t('knowledge.opsDashboard.d7NotLoaded')
                      : driftBadgeStatus === 'drifted'
                        ? t('knowledge.opsDashboard.d7Drifted')
                        : t('knowledge.opsDashboard.d7InSync')
                }}
              </span>
            </div>
            <div
              v-if="!driftSummaryLoaded && !driftLoading"
              class="mb-4 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
            >
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>{{ t('knowledge.opsDashboard.d7NotLoadedHint') }}</p>
                <p v-if="driftFallbackError" class="mt-1 text-rose-600 dark:text-rose-400">
                  {{ driftFallbackError }}
                </p>
              </div>
            </div>
            <div
              v-else-if="driftNoSpacesScanned"
              class="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
              <p>{{ t('knowledge.opsDashboard.d7NoSpaces') }}</p>
            </div>
            <div
              v-else-if="driftShowEmptyWarning"
              class="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <div class="flex min-w-0 items-start gap-2">
                <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
                <p>{{ t('knowledge.opsDashboard.d7ScanEmpty') }}</p>
              </div>
              <button type="button" class="btn-ghost shrink-0 !px-2 !py-1 text-xs" @click="goLintSync">
                {{ t('knowledge.opsDashboard.openSync') }}
                <ExternalLink class="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              v-else-if="(driftSummary?.scanFailedCount ?? 0) > 0"
              class="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
            >
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
              <p>{{ t('knowledge.opsDashboard.d7ScanFailed', { count: driftSummary?.scanFailedCount ?? 0 }) }}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div class="rounded-lg bg-gray-50 px-3 py-3 dark:bg-gray-800/50">
                <p class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d7WikiOnly') }}</p>
                <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ driftSummary?.wikiOnlyTotal ?? 0 }}</p>
              </div>
              <div class="rounded-lg bg-gray-50 px-3 py-3 dark:bg-gray-800/50">
                <p class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d7DbOnly') }}</p>
                <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ driftSummary?.dbOnlyTotal ?? 0 }}</p>
              </div>
              <div class="rounded-lg bg-gray-50 px-3 py-3 dark:bg-gray-800/50">
                <p class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d7HashMismatch') }}</p>
                <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ driftSummary?.hashMismatchTotal ?? 0 }}</p>
              </div>
              <div class="rounded-lg bg-gray-50 px-3 py-3 dark:bg-gray-800/50">
                <p class="text-[11px] text-gray-500">{{ t('knowledge.opsDashboard.d7InSyncCount') }}</p>
                <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ driftSummary?.inSyncTotal ?? 0 }}</p>
              </div>
            </div>
            <ul v-if="driftSamples.length" class="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
              <li
                v-for="space in driftSamples"
                :key="String(space.spaceId ?? space.spaceCode)"
                class="py-2 text-xs"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ space.spaceCode || space.spaceId }}</span>
                  <button type="button" class="btn-ghost !px-2 !py-1 text-xs" @click="goWikiGovern(space.spaceId)">
                    {{ t('knowledge.opsDashboard.openGovern') }}
                    <ExternalLink class="h-3.5 w-3.5" />
                  </button>
                </div>
                <p class="mt-1 text-gray-500 dark:text-gray-400">
                  {{
                    t('knowledge.opsDashboard.d7SpaceStats', {
                      wikiPages: space.wikiPageCount ?? 0,
                      dbPages: space.dbKbPageCount ?? 0,
                      inSync: space.inSyncCount ?? 0,
                      wikiOnly: space.wikiOnlyCount ?? 0,
                      dbOnly: space.dbOnlyCount ?? 0,
                      hash: space.hashMismatchCount ?? 0,
                    })
                  }}
                </p>
                <p v-if="driftScanFailureDetail(space)" class="mt-1 text-rose-600 dark:text-rose-400">
                  {{ driftScanFailureDetail(space) }}
                </p>
              </li>
            </ul>
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {{ t('knowledge.opsDashboard.d7Unresolved', { count: unresolvedRelationCount }) }}
              <button
                v-if="unresolvedRelationCount > 0"
                type="button"
                class="btn-ghost ml-2 !inline-flex !px-2 !py-1 text-xs"
                @click="goGraph"
              >
                {{ t('knowledge.opsDashboard.openGraph') }}
                <ExternalLink class="h-3.5 w-3.5" />
              </button>
            </p>
          </section>
        </div>
      </template>
    </template>

    <AppModal
      :open="evalDrawerOpen"
      wide
      close-on-backdrop
      :title="t('knowledge.opsDashboard.d5HistoryTitle', { strategy: strategyLabel(evalDrawerStrategy) })"
      @close="closeEvalDrawer"
    >
      <p v-if="evalLoading" class="py-8 text-center text-sm text-gray-400">
        <Loader2 class="mx-auto mb-2 h-5 w-5 animate-spin" />
        {{ t('common.loading') }}
      </p>
      <template v-else>
        <KbOpsEvalTrendChart v-if="evalTrend.length" class="mb-4" :points="evalTrend" :locale-tag="localeTag" />
        <div v-if="evalRuns.length" class="overflow-x-auto">
          <table class="w-full min-w-[520px] text-left text-xs">
            <thead class="text-gray-500 dark:text-gray-400">
              <tr>
                <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5RunAt') }}</th>
                <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Hit3') }}</th>
                <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Mrr') }}</th>
                <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Gate') }}</th>
                <th class="pb-2 pr-3 font-medium">{{ t('knowledge.opsDashboard.d5Errors') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in evalRuns" :key="String(run.id ?? run.runAt)" class="border-t border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-3 whitespace-nowrap">{{ formatDateTime(run.runAt) }}</td>
                <td class="py-2 pr-3 tabular-nums">{{ formatHitPct(run.hit3) }}</td>
                <td class="py-2 pr-3 tabular-nums">{{ formatMrr(run.mrr) }}</td>
                <td class="py-2 pr-3">{{ run.gatePass ? t('knowledge.opsDashboard.d5GatePass') : t('knowledge.opsDashboard.d5GateFail') }}</td>
                <td class="py-2 pr-3" :class="(run.errors ?? 0) > 0 ? 'text-rose-600' : ''">{{ run.errors ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-gray-500">{{ t('knowledge.opsDashboard.d5HistoryEmpty') }}</p>
      </template>
    </AppModal>
  </div>
</template>
