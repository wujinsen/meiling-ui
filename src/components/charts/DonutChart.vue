<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useChartReady } from '@/composables/useChartReady'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { pieAnimation } from '@/utils/chartAnimation'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent, GraphicComponent])

const { isDark } = useTheme()
const ready = useChartReady()

const props = withDefaults(
  defineProps<{
    centerText?: string
    /** 居中显示（图例在下方时使用） */
    centered?: boolean
    data?: { name: string; value: number }[]
  }>(),
  {
    centerText: '',
    data: () => [
      { name: 'Referrals', value: 35 },
      { name: 'Organic', value: 28 },
      { name: 'Social', value: 18 },
      { name: 'Paid Ads', value: 12 },
      { name: 'Other', value: 7 },
    ],
  }
)

const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899']

const option = computed(() => {
  const dark = isDark.value
  return {
    ...pieAnimation,
    color: colors,
    tooltip: { trigger: 'item', backgroundColor: dark ? '#1a1d27' : '#fff' },
    legend: dark
      ? { show: false }
      : {
          orient: 'vertical',
          right: 0,
          top: 'center',
          textStyle: { color: '#6b7280', fontSize: 12 },
          formatter: (name: string) => {
            const item = props.data.find((d) => d.name === name)
            return item ? `${name}  ${item.value}%` : name
          },
        },
    series: [
      {
        type: 'pie',
        radius: props.centerText ? ['52%', '72%'] : ['50%', '70%'],
        center: props.centered || !props.centerText ? ['50%', '50%'] : ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: dark ? '#1a1d27' : '#fff', borderWidth: 2 },
        label: { show: false },
        data: ready.value ? props.data : props.data.map((d) => ({ ...d, value: 0 })),
      },
    ],
    graphic: props.centerText
      ? [
          {
            type: 'text',
            left: props.centered ? 'center' : '28%',
            top: '44%',
            style: { text: props.centerText, textAlign: 'center', fill: dark ? '#e5e7eb' : '#111', fontSize: 14, fontWeight: 600 },
          },
        ]
      : [],
  }
})
</script>

<template>
  <div class="chart-container h-[260px]">
    <VChart :option="option" autoresize class="h-full w-full" />
  </div>
</template>
