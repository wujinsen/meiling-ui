<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBiDashboard } from '@/composables/useBiDashboard'
import { useBiQuery } from '@/composables/useBiQuery'
import type { DashboardPeriod } from '@/composables/useChartDatasets'
import BiKpiCard from '@/components/bi/BiKpiCard.vue'
import AnimateIn from '@/components/ui/AnimateIn.vue'
import AnimatedProgress from '@/components/ui/AnimatedProgress.vue'
import PeriodTabs from '@/components/ui/PeriodTabs.vue'
import LineChart from '@/components/charts/LineChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import { ArrowRight, BarChart3 } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const { loading, overview } = useBiDashboard()
const { setPeriod } = useBiQuery()

const period = ref<DashboardPeriod>('monthly')
const periodOptions = computed(() => [
  { value: 'monthly', label: t('common.monthly') },
  { value: 'weekly', label: t('common.weekly') },
  { value: 'quarterly', label: t('common.quarterly') },
])

const leadSourceData = computed(() =>
  overview.value?.leadSources.map((s) => ({
    name: t(s.nameKey),
    value: s.value,
  })) ?? [],
)

watch(period, (p) => {
  if (p === 'weekly') setPeriod('weekly')
  else if (p === 'quarterly') setPeriod('quarterly')
  else setPeriod('monthly')
})

const priorityClass = (priority: 'high' | 'medium' | 'low') => ({
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
}[priority])
</script>

<template>
  <div class="page-stack">
    <div class="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-brand-500 p-4">
      <div>
        <h2 class="page-title">{{ t('bi.dashboardToday.title') }}</h2>
        <p class="page-subtitle">{{ t('bi.dashboardToday.sub') }}</p>
      </div>
      <button type="button" class="btn-primary" @click="router.push('/candlelight/bi')">
        <BarChart3 class="h-4 w-4" />
        {{ t('bi.dashboardToday.goAnalytics') }}
      </button>
    </div>

    <section v-if="overview" class="kpi-grid">
      <AnimateIn v-for="(kpi, i) in overview.kpis" :key="kpi.key" :index="i">
        <BiKpiCard
          :label-key="kpi.labelKey"
          :value="kpi.value"
          :sub-key="kpi.subKey"
        />
      </AnimateIn>
    </section>

    <section class="chart-row">
      <AnimateIn :delay="320" class="chart-row-main">
        <div class="card card-interactive flex h-full flex-col p-5">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="page-title">{{ t('dashboard.revenueOverview.title') }}</h2>
              <p class="page-subtitle">{{ t('dashboard.revenueOverview.sub') }}</p>
            </div>
            <PeriodTabs v-model="period" :options="periodOptions" />
          </div>
          <LineChart multi :period="period" />
        </div>
      </AnimateIn>

      <AnimateIn :delay="400" class="chart-row-side">
        <div class="card card-interactive flex h-full flex-col p-5">
          <h2 class="page-title">{{ t('dashboard.leadSources.title') }}</h2>
          <p class="page-subtitle mb-3">{{ t('dashboard.leadSources.sub') }}</p>
          <DonutChart v-if="leadSourceData.length" :data="leadSourceData" />
        </div>
      </AnimateIn>
    </section>

    <section v-if="overview" class="split-row">
      <AnimateIn :delay="480" class="split-row-item">
        <div class="card card-interactive p-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="page-title">{{ t('dashboard.recentDeals.title') }}</h2>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400"
              @click="router.push('/candlelight/bi')"
            >
              {{ t('bi.dashboardToday.viewFunnel') }}
              <ArrowRight class="h-4 w-4" />
            </button>
          </div>
          <div class="space-y-3">
            <AnimateIn
              v-for="(deal, i) in overview.recentDeals"
              :key="deal.titleKey"
              :index="i"
              :delay="520"
              :y="12"
            >
              <div class="list-item p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="truncate font-medium text-gray-900 dark:text-white">{{ t(deal.titleKey) }}</p>
                      <span :class="['badge shrink-0', deal.statusClass]">{{ t(deal.statusKey) }}</span>
                    </div>
                    <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t(deal.companyKey) }} · {{ deal.date }}</p>
                  </div>
                  <span class="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ deal.value }}</span>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  <AnimatedProgress
                    :percent="deal.progress"
                    :bar-class="deal.progressColor"
                    track-class="h-2 flex-1"
                  />
                  <span class="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                    {{ deal.progress }}%
                  </span>
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </AnimateIn>

      <AnimateIn :delay="560" class="split-row-item">
        <div class="card card-interactive p-5">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="page-title">{{ t('dashboard.tasks.title') }}</h2>
            <span class="text-xs text-gray-400">{{ t('bi.dashboardToday.tasksHint') }}</span>
          </div>
          <div class="space-y-3">
            <AnimateIn
              v-for="(task, i) in overview.tasks"
              :key="task.titleKey"
              :index="i"
              :delay="600"
              :y="12"
            >
              <label class="list-item flex cursor-pointer items-start gap-3 p-4 transition hover:shadow-sm">
                <input type="checkbox" class="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-white/20 dark:bg-white/5" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium leading-snug text-gray-900 dark:text-white">{{ t(task.titleKey) }}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ t(task.typeKey) }}</span>
                    <span :class="['badge', priorityClass(task.priority)]">{{ t(`priority.${task.priority}`) }}</span>
                    <div class="flex -space-x-1">
                      <span
                        v-for="n in task.assignees"
                        :key="n"
                        class="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-200 text-xs font-medium text-brand-700 dark:border-surface-dark-card dark:bg-brand-800 dark:text-brand-200"
                      >{{ n }}</span>
                    </div>
                    <span class="text-xs text-gray-400">{{ t(task.dateKey) }}</span>
                  </div>
                </div>
              </label>
            </AnimateIn>
          </div>
        </div>
      </AnimateIn>
    </section>

    <div v-if="loading && !overview" class="text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('bi.loading') }}
    </div>
  </div>
</template>
