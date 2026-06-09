<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useChartReady } from '@/composables/useChartReady'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GaugeChart } from 'echarts/charts'
import { chartAnimation } from '@/utils/chartAnimation'

use([CanvasRenderer, GaugeChart])

const { isDark } = useTheme()
const ready = useChartReady()

const option = computed(() => {
  const dark = isDark.value
  return {
    ...chartAnimation,
    animationDuration: 1600,
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 4,
        radius: '90%',
        center: ['50%', '75%'],
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.3, '#8b5cf6'],
              [0.7, '#3b82f6'],
              [1, dark ? '#1f2937' : '#e5e7eb'],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: dark ? '#9ca3af' : '#6b7280', distance: -40, fontSize: 10 },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: dark ? '#e5e7eb' : '#111827',
          fontSize: 20,
          fontWeight: 600,
          offsetCenter: [0, '-10%'],
        },
        data: [{ value: ready.value ? 68 : 0 }],
      },
    ],
  }
})
</script>

<template>
  <div class="chart-container h-[200px]">
    <VChart :option="option" autoresize class="h-full w-full" />
  </div>
</template>
