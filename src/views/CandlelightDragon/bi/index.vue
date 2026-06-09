<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBiAnalytics } from '@/composables/useBiAnalytics'
import { useBiQuery } from '@/composables/useBiQuery'
import type { BiRange } from '@/types/bi'
import BiKpiCard from '@/components/bi/BiKpiCard.vue'
import BiTrendBarChart from '@/components/bi/BiTrendBarChart.vue'
import BiDrillDrawer from '@/components/bi/BiDrillDrawer.vue'
import AnimatedProgress from '@/components/ui/AnimatedProgress.vue'
import TopDealsTable from '@/components/ui/TopDealsTable.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import { Users, Filter, FileText, Handshake, Trophy, RefreshCw, FileBarChart } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const { setRange } = useBiQuery()

const {
  loading,
  overview,
  error,
  query,
  drillOpen,
  drillTitle,
  drillRows,
  drillLoading,
  breadcrumb,
  load,
  openDrill,
  closeDrill,
} = useBiAnalytics()

const ranges: BiRange[] = ['7d', '30d', 'month', 'quarter']

const funnelIcons = {
  users: Users,
  filter: Filter,
  file: FileText,
  handshake: Handshake,
  trophy: Trophy,
} as const

const activityColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

const activityChartData = computed(() =>
  overview.value?.activities.map((a) => ({
    name: t(a.nameKey),
    value: a.value,
    count: a.count,
  })) ?? [],
)

const topDealsRows = computed(() =>
  overview.value?.topDeals.map((row) => ({
    ...row,
    status: t(row.statusKey),
  })) ?? [],
)

function onKpiClick(metric?: string, labelKey?: string) {
  if (!metric) return
  openDrill(metric, labelKey ? t(labelKey) : metric)
}

function onFunnelClick(key: string, stageKey: string) {
  openDrill(`funnel:${key}`, t(stageKey))
}
</script>

<template>
  <div class="page-stack">
    <div class="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('bi.rangeLabel') }}</span>
        <select
          :value="query.range"
          class="field-input"
          @change="setRange(($event.target as HTMLSelectElement).value as BiRange)"
        >
          <option v-for="r in ranges" :key="r" :value="r">{{ t(`bi.range.${r}`) }}</option>
        </select>
        <span v-if="overview" class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('bi.refreshedAt', { time: new Date(overview.refreshedAt).toLocaleTimeString() }) }}
        </span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-ghost" :disabled="loading" @click="load">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          {{ t('bi.refresh') }}
        </button>
        <button type="button" class="btn-ghost" @click="router.push('/insight/reports')">
          <FileBarChart class="h-4 w-4" />
          {{ t('bi.goReports') }}
        </button>
      </div>
    </div>

    <p
      v-if="error && overview"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {{ t('bi.mockFallback') }}
    </p>

    <section v-if="overview" class="kpi-grid">
      <BiKpiCard
        v-for="kpi in overview.kpis"
        :key="kpi.key"
        :label-key="kpi.labelKey"
        :value="kpi.value"
        :sub-key="kpi.subKey"
        :change="kpi.change"
        :up="kpi.up"
        :clickable="Boolean(kpi.drillMetric)"
        @click="onKpiClick(kpi.drillMetric, kpi.labelKey)"
      />
    </section>

    <section v-if="overview" class="chart-row">
      <div class="chart-row-main">
        <div class="card card-interactive flex h-full flex-col p-5">
          <div class="mb-4">
            <h2 class="page-title">{{ t('analytics.revenueTrend.title') }}</h2>
            <p class="page-subtitle">{{ t('analytics.revenueTrend.sub') }}</p>
          </div>
          <BiTrendBarChart
            :labels="overview.trend.labels"
            :values="overview.trend.values"
            :target-line="overview.trend.targetLine"
            :highlight-index="overview.trend.highlightIndex"
          />
        </div>
      </div>

      <div class="chart-row-side">
        <div class="card card-interactive flex h-full flex-col p-5">
          <h2 class="page-title">{{ t('analytics.activityBreakdown.title') }}</h2>
          <p class="page-subtitle mb-4">
            {{ t('analytics.activityBreakdown.sub') }} · {{ overview.activityTotal.toLocaleString() }}
          </p>
          <DonutChart
            :center-text="overview.activityTotal.toLocaleString()"
            :data="activityChartData.map((d) => ({ name: d.name, value: d.value }))"
            centered
          />
          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div
              v-for="(item, i) in activityChartData"
              :key="item.name"
              class="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5"
            >
              <span class="flex min-w-0 items-center gap-2 text-gray-600 dark:text-gray-400">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: activityColors[i] }" />
                <span class="truncate">{{ item.name }}</span>
              </span>
              <span class="shrink-0 font-medium tabular-nums text-gray-900 dark:text-white">
                {{ item.value }}% · {{ item.count.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="overview" class="chart-row">
      <div class="chart-row-side">
        <div class="card card-interactive flex h-full flex-col justify-between p-5">
          <div>
            <h2 class="page-title">{{ t('analytics.revenueTarget.title') }}</h2>
            <div class="mt-4 flex items-end justify-between gap-3">
              <span class="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{{ overview.targetPercent }}%</span>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ t(overview.targetLeftKey) }}</span>
            </div>
          </div>
          <div class="mt-6">
            <AnimatedProgress
              :percent="overview.targetPercent"
              striped
              track-class="h-3"
              bar-class="bg-gradient-to-r from-brand-500 to-brand-600"
            />
            <p class="mt-2 text-right text-xs font-medium text-gray-400 dark:text-gray-500">
              {{ t('analytics.revenueTarget.goal') }}
            </p>
          </div>
        </div>
      </div>

      <div class="chart-row-main">
        <div class="card card-interactive p-5">
          <h2 class="page-title mb-4">{{ t('analytics.salesFunnel.title') }}</h2>
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="item in overview.funnel"
              :key="item.key"
              type="button"
              class="list-item flex items-center gap-3 p-3 text-left transition hover:shadow-sm"
              @click="onFunnelClick(item.key, item.stageKey)"
            >
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                <component :is="funnelIcons[item.icon]" class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-gray-900 dark:text-white">{{ t(item.stageKey) }}</p>
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ t(item.descKey) }}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-0.5">
                <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ item.count.toLocaleString() }}</span>
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  {{ item.rate }}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="overview" class="split-row xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div class="min-w-0">
        <div class="card card-interactive p-5">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="page-title">{{ t('analytics.topDeals.title') }}</h2>
            <button
              type="button"
              class="text-sm font-medium text-brand-600 dark:text-brand-400"
              @click="openDrill('deals', t('analytics.topDeals.title'))"
            >
              {{ t('common.viewAll') }}
            </button>
          </div>
          <TopDealsTable :rows="topDealsRows" />
        </div>
      </div>

      <div class="min-w-0">
        <div class="card card-interactive p-5">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="page-title">{{ t('analytics.teamPerformance.title') }}</h2>
            <button
              type="button"
              class="text-sm font-medium text-brand-600 dark:text-brand-400"
              @click="openDrill('team', t('analytics.teamPerformance.title'))"
            >
              {{ t('common.viewAll') }}
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="member in overview.team"
              :key="member.name"
              class="list-item flex items-center gap-3 p-3"
            >
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
                {{ member.avatar }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-gray-900 dark:text-white">{{ member.name }}</p>
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ t(member.roleKey) }}</p>
              </div>
              <span class="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {{ member.deals }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="loading && !overview" class="flex min-h-[40vh] items-center justify-center text-gray-500 dark:text-gray-400">
      {{ t('bi.loading') }}
    </div>

    <BiDrillDrawer
      :open="drillOpen"
      :title="drillTitle"
      :breadcrumb="breadcrumb"
      :rows="drillRows"
      :loading="drillLoading"
      @close="closeDrill"
    />
  </div>
</template>
