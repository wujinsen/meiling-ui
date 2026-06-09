<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { chartAnimation } from '@/utils/chartAnimation'
import type { PersonaTrendPoint } from '@/types/persona'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{ data: PersonaTrendPoint[] }>()
const { t } = useI18n()
const { isDark } = useTheme()

const option = computed(() => {
  const dark = isDark.value
  const textColor = dark ? '#9ca3af' : '#6b7280'
  const lineColor = dark ? '#374151' : '#e5e7eb'

  return {
    ...chartAnimation,
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderColor: lineColor,
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
    },
    legend: {
      data: [t('persona.chart.active'), t('persona.chart.newUsers')],
      textStyle: { color: textColor },
      top: 0,
    },
    grid: { left: 48, right: 24, top: 40, bottom: 28 },
    xAxis: {
      type: 'category',
      data: props.data.map((d) => d.label),
      axisLine: { lineStyle: { color: lineColor } },
      axisLabel: { color: textColor },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: lineColor, type: 'dashed' } },
      axisLabel: { color: textColor },
    },
    series: [
      {
        name: t('persona.chart.active'),
        type: 'line',
        smooth: true,
        data: props.data.map((d) => d.active),
        itemStyle: { color: '#8b5cf6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139,92,246,0.22)' },
              { offset: 1, color: 'rgba(139,92,246,0)' },
            ],
          },
        },
      },
      {
        name: t('persona.chart.newUsers'),
        type: 'line',
        smooth: true,
        data: props.data.map((d) => d.newUsers),
        itemStyle: { color: '#10b981' },
        lineStyle: { type: 'dashed' },
      },
    ],
  }
})
</script>

<template>
  <VChart class="h-[240px] w-full" :option="option" autoresize />
</template>
