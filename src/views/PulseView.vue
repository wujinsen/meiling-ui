<script setup lang="ts">

import { computed, ref } from 'vue'

import { useI18n } from 'vue-i18n'

import { usePageData } from '@/composables/usePageData'

import { useTheme } from '@/composables/useTheme'

import { useChartReady } from '@/composables/useChartReady'

import type { PulseRange } from '@/composables/useChartDatasets'

import KpiCard from '@/components/ui/KpiCard.vue'

import AnimateIn from '@/components/ui/AnimateIn.vue'

import LineChart from '@/components/charts/LineChart.vue'

import TrafficDonutChart from '@/components/charts/TrafficDonutChart.vue'

import TimeRangeTabs from '@/components/ui/TimeRangeTabs.vue'

import { chartAnimation } from '@/utils/chartAnimation'

import VChart from 'vue-echarts'

import { use } from 'echarts/core'

import { CanvasRenderer } from 'echarts/renderers'

import { BarChart as EBarChart } from 'echarts/charts'

import { GridComponent, TooltipComponent } from 'echarts/components'



use([CanvasRenderer, EBarChart, GridComponent, TooltipComponent])



const { t } = useI18n()

const { isDark } = useTheme()

const ready = useChartReady()

const { pulseKpis, aiInsights, chartRegions, trafficSourceData } = usePageData()



const range = ref<PulseRange>('30D')

const dismissed = ref<Set<string>>(new Set())



const visibleInsights = computed(() => aiInsights.value.filter((item) => !dismissed.value.has(item.title)))



const churnValues = [12, 28, 15, 8]



const churnOption = computed(() => {

  const dark = isDark.value

  const values = ready.value ? churnValues : churnValues.map(() => 0)

  return {

    ...chartAnimation,

    grid: { left: 40, right: 16, top: 16, bottom: 28 },

    tooltip: { trigger: 'axis', backgroundColor: dark ? '#1a1d27' : '#fff', borderColor: dark ? '#374151' : '#e5e7eb', textStyle: { color: dark ? '#e5e7eb' : '#111' } },

    xAxis: { type: 'category', data: chartRegions.value, axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }, axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } } },

    yAxis: { type: 'value', axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }, splitLine: { lineStyle: { color: dark ? '#1f2937' : '#f3f4f6' } } },

    series: [{

      type: 'bar',

      data: values,

      itemStyle: { color: '#a78bfa', borderRadius: [4, 4, 0, 0] },

      barWidth: 28,

      animationDelay: (idx: number) => idx * 120,

    }],

  }

})



function dismissInsight(title: string) {

  dismissed.value = new Set([...dismissed.value, title])

}

</script>



<template>

  <div class="flex flex-col gap-6 xl:flex-row">

    <div class="min-w-0 flex-1 space-y-6">

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <AnimateIn

          v-for="(kpi, i) in pulseKpis"

          :key="kpi.label"

          :index="i"

        >

          <KpiCard v-bind="kpi" />

        </AnimateIn>

      </div>



      <AnimateIn :delay="320">

        <div class="card card-interactive p-5">

          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">

            <div>

              <h2 class="page-title">{{ t('pulse.revenueUsers.title') }}</h2>

              <p class="page-subtitle">{{ t('pulse.revenueUsers.sub') }}</p>

            </div>

            <TimeRangeTabs v-model="range" />

          </div>

          <LineChart :range="range" />

        </div>

      </AnimateIn>



      <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-2">

        <AnimateIn :delay="400">

          <div class="card card-interactive p-5">

            <h2 class="page-title mb-1">{{ t('pulse.churnByRegion.title') }}</h2>

            <p class="page-subtitle mb-2">{{ t('pulse.churnByRegion.sub') }}</p>

            <div class="chart-container h-[220px]">

              <VChart :option="churnOption" autoresize class="h-full w-full" />

            </div>

          </div>

        </AnimateIn>

        <AnimateIn :delay="480">

          <div class="card card-interactive p-5">

            <h2 class="page-title mb-1">{{ t('pulse.trafficSources.title') }}</h2>

            <p class="page-subtitle mb-2">{{ t('pulse.trafficSources.sub') }}</p>

            <TrafficDonutChart :data="trafficSourceData" />

          </div>

        </AnimateIn>

      </div>



      <div class="space-y-3 xl:hidden">

        <h2 class="page-title flex items-center gap-2">

          <span class="text-lg text-brand-500">✦</span>

          {{ t('pulse.aiInsights.title') }}

        </h2>

        <TransitionGroup name="insight-list" tag="div" class="space-y-3">

          <div

            v-for="insight in visibleInsights"

            :key="insight.title"

            class="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/5 dark:bg-surface-dark-elevated"

          >

            <span :class="['badge mb-2', insight.typeColor]">{{ insight.type }}</span>

            <p class="font-medium text-gray-900 dark:text-white">{{ insight.title }}</p>

            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ insight.desc }}</p>

            <div class="mt-3 flex gap-2">

              <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">{{ insight.action }}</button>

              <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5" @click="dismissInsight(insight.title)">{{ t('common.dismiss') }}</button>

            </div>

          </div>

        </TransitionGroup>

      </div>

    </div>



    <aside class="hidden w-80 shrink-0 xl:block">

      <AnimateIn :delay="360">

        <div class="card sticky top-0 p-4">

          <div class="mb-4 flex items-center gap-2">

            <span class="text-lg text-brand-500">✦</span>

            <h2 class="page-title">{{ t('pulse.aiInsights.title') }}</h2>

          </div>

          <TransitionGroup name="insight-list" tag="div" class="space-y-3">

            <AnimateIn

              v-for="(insight, i) in visibleInsights"

              :key="insight.title"

              :index="i"

              :delay="400"

              :y="16"

            >

              <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-300 dark:border-white/5 dark:bg-surface-dark-elevated dark:hover:border-brand-500/30">

                <span :class="['badge mb-2', insight.typeColor]">{{ insight.type }}</span>

                <p class="font-medium text-gray-900 dark:text-white">{{ insight.title }}</p>

                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ insight.desc }}</p>

                <div class="mt-3 flex gap-2">

                  <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">{{ insight.action }}</button>

                  <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5" @click="dismissInsight(insight.title)">{{ t('common.dismiss') }}</button>

                </div>

              </div>

            </AnimateIn>

          </TransitionGroup>

        </div>

      </AnimateIn>

    </aside>

  </div>

</template>

