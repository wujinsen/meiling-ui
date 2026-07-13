<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Activity,
  AlertTriangle,
  Bot,
  ExternalLink,
  Link2Off,
  Loader2,
  RefreshCw,
} from 'lucide-vue-next'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import KbOpsSyncTrendChart from '@/components/knowledge/KbOpsSyncTrendChart.vue'
import { getKbLintIssuesApi, getKbLlmConfigApi, getKbOpsDashboardApi, getKbSyncLogsApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbLlmConfig } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import {
  aggregatePendingIssues,
  aggregateSyncTrendByDay,
  applyKbOpsDashboardVo,
  topBrokenLinkIssues,
  type KbBrokenLinkRow,
  type KbPendingIssueBucket,
  type KbSyncTrendDay,
} from '@/utils/kbOpsDashboard'
import { kbLintRoute, kbLlmSettingsRoute, kbWikiGovernRoute } from '@/utils/kbWorkflowRoutes'

const { t, locale } = useI18n()
const router = useRouter()
const { spaces, ensureSpacesLoaded } = useKbSpace()

const canView = computed(() => assertAction(PERM.KB_OPS_DASHBOARD))

const loading = ref(false)
const syncTrend = ref<KbSyncTrendDay[]>([])
const pendingBuckets = ref<KbPendingIssueBucket[]>([])
const brokenTop = ref<KbBrokenLinkRow[]>([])
const llmConfig = ref<KbLlmConfig | null>(null)
const syncLogTotal = ref(0)
const dashboardSource = ref<'api' | 'legacy'>('api')

const pendingTotal = computed(() => pendingBuckets.value.reduce((sum, row) => sum + row.count, 0))
const syncWeekTotal = computed(() =>
  syncTrend.value.reduce((sum, row) => sum + row.success + row.fail, 0),
)
const syncWeekFails = computed(() => syncTrend.value.reduce((sum, row) => sum + row.fail, 0))

const llmStatus = computed<'ok' | 'warn' | 'off'>(() => {
  const cfg = llmConfig.value
  if (!cfg) return 'off'
  if (cfg.available) return 'ok'
  if (cfg.configEnabled || cfg.apiKeyConfigured) return 'warn'
  return 'off'
})

function issueTypeLabel(type: string) {
  const key = `knowledge.opsDashboard.issueTypes.${type}`
  const translated = t(key)
  return translated === key ? type : translated
}

async function loadDashboardLegacy() {
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

  const localeTag = locale.value === 'ja' ? 'ja-JP' : locale.value === 'en' ? 'en-US' : 'zh-CN'
  syncTrend.value = aggregateSyncTrendByDay(logs, 7).map((row) => ({
    ...row,
    label: new Date(`${row.date}T12:00:00`).toLocaleDateString(localeTag, { month: 'numeric', day: 'numeric' }),
  }))
  pendingBuckets.value = aggregatePendingIssues(issues, spaces.value)
  brokenTop.value = topBrokenLinkIssues(issues, spaces.value, 10)
}

async function loadDashboard() {
  if (!canView.value) return
  loading.value = true
  try {
    const dashRes = await getKbOpsDashboardApi({ trendDays: 7 })
    if (dashRes.code === API_SUCCESS_CODE && dashRes.data) {
      dashboardSource.value = 'api'
      const localeTag = locale.value === 'ja' ? 'ja-JP' : locale.value === 'en' ? 'en-US' : 'zh-CN'
      const mapped = applyKbOpsDashboardVo(
        dashRes.data,
        spaces.value,
        t('knowledge.opsDashboard.allSpaces'),
        localeTag,
      )
      syncTrend.value = mapped.syncTrend.map((row) => ({
        ...row,
        label: new Date(`${row.date}T12:00:00`).toLocaleDateString(localeTag, { month: 'numeric', day: 'numeric' }),
      }))
      pendingBuckets.value = mapped.pendingBuckets
      brokenTop.value = mapped.brokenTop
      syncLogTotal.value = mapped.openCount
      const llm = dashRes.data.llm
      llmConfig.value = {
        configEnabled: Boolean(llm?.enabled),
        available: Boolean(llm?.available),
        apiKeyConfigured: Boolean(llm?.available || llm?.enabled),
        provider: llm?.provider,
        model: llm?.model,
      }
      return
    }
    dashboardSource.value = 'legacy'
    await loadDashboardLegacy()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.opsDashboard.loadFailed'))
  } finally {
    loading.value = false
  }
}

function goLint(spaceId?: string) {
  void router.push(kbLintRoute({ spaceId: spaceId && spaceId !== '_unknown' ? spaceId : null }))
}

function goLintSync() {
  void router.push(kbLintRoute({ tab: 'sync' }))
}

function goWikiGovern(spaceId?: string) {
  void router.push(kbWikiGovernRoute(spaceId && spaceId !== '_unknown' ? spaceId : null))
}

function goLlmSettings() {
  void router.push(kbLlmSettingsRoute())
}

onMounted(async () => {
  await ensureSpacesLoaded()
  await loadDashboard()
})
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
        :disabled="loading"
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
      <p v-if="loading && !llmConfig && !pendingBuckets.length" class="card p-16 text-center text-sm text-gray-400">
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

          <!-- D3 LLM 可用 -->
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
        </div>
      </template>
    </template>
  </div>
</template>
