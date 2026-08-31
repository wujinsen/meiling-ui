<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { useChartReady } from '@/composables/useChartReady'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart as EBarChart, LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { chartAnimation } from '@/utils/chartAnimation'
import { formatDayLabel } from '@/utils/kbOpsDashboard'
import type { KbOpsLlmCostTrendPoint } from '@/types/knowledge'

use([CanvasRenderer, EBarChart, ELineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  points: KbOpsLlmCostTrendPoint[]
  localeTag?: string
}>()

const { isDark } = useTheme()
const { t, locale } = useI18n()
const ready = useChartReady()

const option = computed(() => {
  const dark = isDark.value
  const textColor = dark ? '#9ca3af' : '#6b7280'
  const lineColor = dark ? '#374151' : '#e5e7eb'
  const tag = props.localeTag || (locale.value === 'ja' ? 'ja-JP' : locale.value === 'en' ? 'en-US' : 'zh-CN')
  const labels = props.points.map((p) => formatDayLabel(p.date, tag))
  const cost = ready.value ? props.points.map((p) => Number(p.estimatedCostUsd) || 0) : props.points.map(() => 0)
  const hits = ready.value ? props.points.map((p) => Number(p.cacheHits) || 0) : props.points.map(() => 0)

  return {
    ...chartAnimation,
    grid: { left: 44, right: 40, top: 28, bottom: 24 },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: textColor, fontSize: 11 },
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
    yAxis: [
      {
        type: 'value',
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: dark ? '#1f2937' : '#f3f4f6' } },
      },
      {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: t('knowledge.opsDashboard.d6Cost'),
        type: 'line',
        smooth: true,
        data: cost,
        yAxisIndex: 0,
        itemStyle: { color: '#8b5cf6' },
        lineStyle: { width: 2 },
      },
      {
        name: t('knowledge.opsDashboard.d6CacheHits'),
        type: 'bar',
        data: hits,
        yAxisIndex: 1,
        barMaxWidth: 16,
        itemStyle: { color: '#34d399', borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
})
</script>

<template>
  <div class="chart-container h-[180px]">
    <VChart :option="option" autoresize class="h-full w-full" />
  </div>
</template>
