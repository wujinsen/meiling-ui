<script setup lang="ts">
import '@/styles/cockpit.css'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProbeAllHealth } from '@/composables/useProbeAllHealth'
import { useCockpit } from '@/composables/useCockpit'
import CockpitHeader from '@/views/CandlelightDragon/cockpit/components/CockpitHeader.vue'
import CockpitKpiCard from '@/views/CandlelightDragon/cockpit/components/CockpitKpiCard.vue'
import CockpitTrendChart from '@/views/CandlelightDragon/cockpit/components/CockpitTrendChart.vue'
import CockpitDonut from '@/views/CandlelightDragon/cockpit/components/CockpitDonut.vue'
import CockpitOpsEnvChart from '@/views/CandlelightDragon/cockpit/components/CockpitOpsEnvChart.vue'
import CockpitDrillDrawer from '@/views/CandlelightDragon/cockpit/components/CockpitDrillDrawer.vue'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import { environmentI18nKey } from '@/utils/operationEnv'
import {
  AlertTriangle,
  FileText,
  Filter,
  Handshake,
  Server,
  Trophy,
  Users,
  Boxes,
  Layers,
  Monitor,
  Activity,
} from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

const {
  loading,
  overview,
  filters,
  autoRefresh,
  drillOpen,
  drillTitle,
  drillRows,
  drillLoading,
  breadcrumb,
  loadOverview,
  openDrill,
  closeDrill,
} = useCockpit()

const {
  drawerOpen: taskDrawerOpen,
  task: taskDetail,
  logText: taskLogText,
  polling: taskPolling,
  closeDrawer: closeTaskDrawer,
  probeAll: probeAllFromCockpit,
  busy: probingAll,
} = useProbeAllHealth({ onFinished: loadOverview })

const funnelIcons = {
  users: Users,
  filter: Filter,
  file: FileText,
  handshake: Handshake,
  trophy: Trophy,
} as const

const sourceLabels = computed(() =>
  overview.value?.leadSources.map((s) => t(s.name)) ?? [],
)

const opsCards = computed(() => {
  const ops = overview.value?.ops
  if (!ops) return []
  return [
    { key: 'projects', label: t('cockpit.ops.projects'), value: ops.projects, icon: Layers, path: '/operation/project' },
    { key: 'servers', label: t('cockpit.ops.servers'), value: ops.servers, icon: Server, path: '/operation/server' },
    { key: 'platforms', label: t('cockpit.ops.platforms'), value: ops.platforms, icon: Monitor, path: '/operation/platform' },
    { key: 'components', label: t('cockpit.ops.components'), value: ops.components, icon: Boxes, path: '/operation/component' },
  ]
})

const alertClass: Record<string, string> = {
  warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  info: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300',
}

function toggleFullscreen() {
  const el = rootRef.value ?? document.documentElement
  if (!document.fullscreenElement) {
    el.requestFullscreen?.()
    isFullscreen.value = true
  } else {
    document.exitFullscreen?.()
    isFullscreen.value = false
  }
}

function onKpiClick(metric?: string, labelKey?: string) {
  if (!metric) return
  openDrill(metric, labelKey ? t(labelKey) : metric)
}

function onFunnelClick(key: string, stageKey: string) {
  openDrill(`funnel:${key}`, t(stageKey))
}

function onSourceClick(item: { name: string; drillKey?: string }) {
  openDrill(`source:${item.drillKey ?? 'other'}`, t(item.name))
}

function goOps(path: string) {
  router.push(path).catch(() => {
    openDrill('ops:nav', t('cockpit.opsNavHint'))
  })
}

function onEnvBreakdownClick(env: number) {
  openDrill(`ops:env:${env}`, t(environmentI18nKey(env)))
}
</script>

<template>
  <div ref="rootRef" class="page-stack" :class="{ 'cockpit-fullscreen': isFullscreen }">
    <CockpitHeader
      :filters="filters"
      :loading="loading"
      :refreshed-at="overview?.refreshedAt"
      :auto-refresh="autoRefresh"
      :is-fullscreen="isFullscreen"
      @refresh="loadOverview"
      @update:auto-refresh="autoRefresh = $event"
      @update:tab="filters.tab = $event"
      @update:range="filters.range = $event"
      @update:granularity="filters.granularity = $event"
      @update:environment="filters.environment = $event"
      @toggle-fullscreen="toggleFullscreen"
    />

    <section v-if="overview" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <CockpitKpiCard
        v-for="kpi in overview.kpis"
        :key="kpi.key"
        :label="t(kpi.label)"
        :value="kpi.value"
        :change="kpi.change"
        :up="kpi.up"
        :sub="kpi.sub ? t(kpi.sub) : undefined"
        :clickable="Boolean(kpi.drillMetric)"
        @click="onKpiClick(kpi.drillMetric, kpi.label)"
      />
    </section>

    <section v-if="overview && filters.tab === 'business'" class="chart-row">
      <div class="card card-interactive chart-row-main flex h-full flex-col p-5">
        <div class="mb-4">
          <h2 class="page-title">{{ t('cockpit.chart.revenueTrend') }}</h2>
          <p class="page-subtitle">{{ t('cockpit.chart.revenueTrendSub') }}</p>
        </div>
        <CockpitTrendChart :data="overview.revenueTrend" />
      </div>
      <div class="card card-interactive chart-row-side flex h-full flex-col p-5">
        <h2 class="page-title">{{ t('cockpit.chart.leadSources') }}</h2>
        <p class="page-subtitle mb-3">{{ t('cockpit.chart.leadSourcesSub') }}</p>
        <CockpitDonut :data="overview.leadSources" :labels="sourceLabels" @slice-click="onSourceClick" />
      </div>
    </section>

    <section v-if="overview && filters.tab === 'ops'" class="chart-row">
      <div class="card card-interactive chart-row-main flex h-full flex-col p-5">
        <div class="mb-4">
          <h2 class="page-title">{{ t('cockpit.chart.envBreakdown') }}</h2>
          <p class="page-subtitle">{{ t('cockpit.chart.envBreakdownSub') }}</p>
        </div>
        <CockpitOpsEnvChart :breakdown="overview.ops.envBreakdown" @env-click="onEnvBreakdownClick" />
      </div>
      <div class="card card-interactive chart-row-side flex h-full flex-col p-5">
        <h2 class="page-title">{{ t('cockpit.ops.title') }}</h2>
        <p class="page-subtitle mb-4">{{ t('cockpit.ops.sub') }}</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="card in opsCards"
            :key="card.key"
            type="button"
            class="list-item p-3 text-left transition hover:shadow-sm"
            @click="goOps(card.path)"
          >
            <component :is="card.icon" class="h-5 w-5 text-brand-500 dark:text-brand-400" />
            <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{{ card.value }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          </button>
        </div>
        <button
          type="button"
          class="btn-ghost mt-4 w-full justify-center text-sm"
          :disabled="probingAll"
          @click="probeAllFromCockpit"
        >
          <Activity class="h-4 w-4" :class="{ 'animate-pulse': probingAll }" />
          {{ probingAll ? t('cockpit.ops.probeAllRunning') : t('cockpit.ops.probeAll') }}
        </button>
      </div>
    </section>

    <section v-if="overview" class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div v-if="filters.tab === 'business'" class="card card-interactive p-5 xl:col-span-5">
        <h2 class="page-title mb-4">{{ t('cockpit.funnel.title') }}</h2>
        <div class="space-y-2">
          <button
            v-for="stage in overview.funnel"
            :key="stage.key"
            type="button"
            class="list-item flex w-full items-center gap-3 p-3 text-left transition hover:shadow-sm"
            @click="onFunnelClick(stage.key, stage.stage)"
          >
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
              <component :is="funnelIcons[stage.icon]" class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-gray-900 dark:text-white">{{ t(stage.stage) }}</p>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ t(stage.desc) }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-semibold tabular-nums text-gray-900 dark:text-white">{{ stage.count.toLocaleString() }}</p>
              <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {{ stage.rate }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <div v-if="filters.tab === 'business'" class="card card-interactive p-5 xl:col-span-4">
        <h2 class="page-title">{{ t('cockpit.ops.title') }}</h2>
        <p class="page-subtitle mb-4">{{ t('cockpit.ops.sub') }}</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="card in opsCards"
            :key="card.key"
            type="button"
            class="list-item p-3 text-left transition hover:shadow-sm"
            @click="goOps(card.path)"
          >
            <component :is="card.icon" class="h-5 w-5 text-brand-500 dark:text-brand-400" />
            <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{{ card.value }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          </button>
        </div>
      </div>

      <div class="card card-interactive p-5" :class="filters.tab === 'ops' ? 'xl:col-span-8' : 'xl:col-span-3'">
        <h2 class="page-title mb-4">{{ t('cockpit.alerts.title') }}</h2>
        <div class="max-h-[280px] space-y-2 overflow-y-auto">
          <div
            v-for="alert in overview.alerts"
            :key="alert.id"
            :class="['flex items-start gap-2 rounded-lg border px-3 py-2', alertClass[alert.level]]"
          >
            <AlertTriangle class="h-4 w-4 shrink-0" />
            <p class="min-w-0 flex-1 text-sm">{{ t(alert.text) }}</p>
            <span class="shrink-0 text-xs opacity-70">{{ alert.time }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="overview && filters.tab === 'business'" class="card card-interactive p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="page-title">{{ t('cockpit.topDeals.title') }}</h2>
        <button
          type="button"
          class="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          @click="openDrill('deals', t('cockpit.topDeals.title'))"
        >
          {{ t('cockpit.viewAll') }}
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/5">
              <th class="pb-3 pr-4">{{ t('cockpit.topDeals.company') }}</th>
              <th class="pb-3 pr-4">{{ t('cockpit.topDeals.value') }}</th>
              <th class="pb-3 pr-4">{{ t('cockpit.topDeals.owner') }}</th>
              <th class="pb-3 pr-4">{{ t('cockpit.topDeals.stage') }}</th>
              <th class="pb-3">{{ t('cockpit.topDeals.prob') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in overview.topDeals"
              :key="i"
              class="border-b border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="py-3 pr-4 font-medium text-gray-900 dark:text-white">{{ row.company }}</td>
              <td class="py-3 pr-4 font-medium text-gray-900 dark:text-white">{{ row.value }}</td>
              <td class="py-3 pr-4 text-gray-600 dark:text-gray-300">{{ row.owner }}</td>
              <td class="py-3 pr-4 text-gray-600 dark:text-gray-300">{{ row.stage }}</td>
              <td class="py-3 font-semibold text-emerald-600 dark:text-emerald-400">{{ row.prob }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="loading && !overview" class="flex min-h-[40vh] items-center justify-center text-gray-500 dark:text-gray-400">
      {{ t('cockpit.loading') }}
    </div>

    <CockpitDrillDrawer
      :open="drillOpen"
      :title="drillTitle"
      :breadcrumb="breadcrumb"
      :rows="drillRows"
      :loading="drillLoading"
      @close="closeDrill"
    />

    <DeployTaskDrawer
      :open="taskDrawerOpen"
      :task="taskDetail"
      :log-text="taskLogText"
      :polling="taskPolling"
      @close="closeTaskDrawer"
    />
  </div>
</template>
