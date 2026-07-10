<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { useChartReady } from '@/composables/useChartReady'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart as EBarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { chartAnimation } from '@/utils/chartAnimation'
import type { KbSyncTrendDay } from '@/utils/kbOpsDashboard'

use([CanvasRenderer, EBarChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  days: KbSyncTrendDay[]
}>()

const { isDark } = useTheme()
const { t } = useI18n()
const ready = useChartReady()

const option = computed(() => {
  const dark = isDark.value
  const textColor = dark ? '#9ca3af' : '#6b7280'
  const lineColor = dark ? '#374151' : '#e5e7eb'
  const labels = props.days.map((d) => d.label)
  const success = ready.value ? props.days.map((d) => d.success) : props.days.map(() => 0)
  const fail = ready.value ? props.days.map((d) => d.fail) : props.days.map(() => 0)
  const max = Math.max(...success, ...fail, 1) + 2

  return {
    ...chartAnimation,
    grid: { left: 40, right: 16, top: 40, bottom: 28 },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: textColor, fontSize: 11 },
      data: [t('knowledge.opsDashboard.syncSuccess'), t('knowledge.opsDashboard.syncFail')],
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderColor: lineColor,
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: lineColor } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      max,
      axisLabel: { color: textColor },
      splitLine: { lineStyle: { color: dark ? '#1f2937' : '#f3f4f6' } },
    },
    series: [
      {
        name: t('knowledge.opsDashboard.syncSuccess'),
        type: 'bar',
        stack: 'sync',
        data: success,
        barMaxWidth: 28,
        itemStyle: { color: '#10b981', borderRadius: [0, 0, 0, 0] },
      },
      {
        name: t('knowledge.opsDashboard.syncFail'),
        type: 'bar',
        stack: 'sync',
        data: fail,
        barMaxWidth: 28,
        itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
})
</script>

<template>
  <div class="chart-container h-[240px]">
    <VChart :option="option" autoresize class="h-full w-full" />
  </div>
</template>
