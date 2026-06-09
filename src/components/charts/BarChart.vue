<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { useChartReady } from '@/composables/useChartReady'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart as EBarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { chartAnimation } from '@/utils/chartAnimation'

use([CanvasRenderer, EBarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

const { isDark } = useTheme()
const { t, tm } = useI18n()
const ready = useChartReady()

const barValues = [142, 168, 195, 276, 210, 248]

const option = computed(() => {
  const dark = isDark.value
  const months = tm('chart.months') as string[]
  const mutedBar = dark ? '#374151' : '#e5e7eb'
  const textColor = dark ? '#9ca3af' : '#6b7280'
  const lineColor = dark ? '#374151' : '#e5e7eb'
  const values = ready.value ? barValues : barValues.map(() => 0)

  const stripeDecal = {
    symbol: 'line',
    symbolSize: 1,
    rotation: -0.65,
    color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    dashArrayX: [1, 0],
    dashArrayY: [3, 4],
  }

  return {
    ...chartAnimation,
    aria: { enabled: true, decal: { show: true } },
    grid: { left: 48, right: 24, top: 32, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderColor: lineColor,
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
      formatter: (params: { value: number }[]) => `$${params[0]?.value ?? 0}k`,
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: lineColor } },
    },
    yAxis: {
      type: 'value',
      max: 280,
      axisLabel: { color: textColor, formatter: '${value}k' },
      splitLine: { lineStyle: { color: dark ? '#1f2937' : '#f3f4f6' } },
    },
    series: [
      {
        type: 'bar',
        data: values.map((value, i) => ({
          value,
          itemStyle: {
            color: i === 3 ? '#6366f1' : mutedBar,
            borderRadius: [6, 6, 0, 0],
            decal: i === 3 ? undefined : stripeDecal,
          },
        })),
        barWidth: 36,
        animationDelay: (idx: number) => idx * 120,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#6366f1', type: 'dashed', width: 1.5 },
          label: { formatter: t('chart.targetLine'), color: '#6366f1', fontSize: 11 },
          data: [{ yAxis: 180 }],
        },
      },
    ],
  }
})
</script>

<template>
  <div class="chart-container h-[280px]">
    <VChart :option="option" autoresize class="h-full w-full" />
  </div>
</template>
