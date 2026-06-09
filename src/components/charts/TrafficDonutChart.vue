<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useChartReady } from '@/composables/useChartReady'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { pieAnimation } from '@/utils/chartAnimation'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent])

const props = withDefaults(
  defineProps<{
    data?: { name: string; value: number }[]
  }>(),
  {
    data: () => [
      { name: 'Organic', value: 42 },
      { name: 'Paid', value: 28 },
      { name: 'Referral', value: 18 },
      { name: 'Direct', value: 12 },
    ],
  }
)

const { isDark } = useTheme()
const ready = useChartReady()

const colors = ['#22d3ee', '#3b82f6', '#8b5cf6', '#ec4899']

const option = computed(() => {
  const dark = isDark.value
  return {
    ...pieAnimation,
    color: colors,
    tooltip: { trigger: 'item', backgroundColor: dark ? '#1a1d27' : '#fff' },
    legend: {
      orient: 'vertical',
      left: 'center',
      top: '58%',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
      formatter: (name: string) => {
        const item = props.data.find((d) => d.name === name)
        return item ? `${name}  ${item.value}%` : name
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '42%'],
        startAngle: 180,
        endAngle: 360,
        itemStyle: { borderRadius: 4, borderColor: dark ? '#161a24' : '#fff', borderWidth: 2 },
        label: { show: false },
        data: ready.value ? props.data : props.data.map((d) => ({ ...d, value: 0 })),
      },
    ],
  }
})
</script>

<template>
  <div class="chart-container h-[220px]">
    <VChart :option="option" autoresize class="h-full w-full" />
  </div>
</template>
