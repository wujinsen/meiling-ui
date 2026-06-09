<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { pieAnimation } from '@/utils/chartAnimation'
import type { PieItem } from '@/types/cockpit'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent])

const props = defineProps<{
  data: PieItem[]
  labels: string[]
}>()

const emit = defineEmits<{ sliceClick: [PieItem] }>()

const { isDark } = useTheme()
const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6b7280']

const option = computed(() => {
  const dark = isDark.value
  const textColor = dark ? '#9ca3af' : '#6b7280'
  const borderColor = dark ? '#1a1d27' : '#fff'

  return {
    ...pieAnimation,
    color: colors,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor, borderWidth: 2 },
        label: { show: false },
        data: props.data.map((item, i) => ({
          name: props.labels[i] ?? item.name,
          value: item.value,
          itemStyle: { color: colors[i % colors.length] },
        })),
      },
    ],
  }
})

function onClick(params: { dataIndex?: number }) {
  if (params.dataIndex != null && props.data[params.dataIndex]) {
    emit('sliceClick', props.data[params.dataIndex])
  }
}
</script>

<template>
  <VChart class="h-[240px] w-full" :option="option" autoresize @click="onClick" />
</template>
