<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { pieAnimation } from '@/utils/chartAnimation'
import {
  environmentChartColor,
  environmentI18nKey,
  normalizeEnvBreakdown,
  type EnvBreakdownItem,
} from '@/utils/operationEnv'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent])

const props = defineProps<{
  breakdown?: EnvBreakdownItem[]
}>()

const emit = defineEmits<{ envClick: [env: number] }>()

const { t } = useI18n()
const { isDark } = useTheme()

const rows = computed(() => normalizeEnvBreakdown(props.breakdown))
const total = computed(() => rows.value.reduce((sum, row) => sum + row.count, 0))
const hasData = computed(() => total.value > 0)

const option = computed(() => {
  const dark = isDark.value
  const textColor = dark ? '#9ca3af' : '#6b7280'
  const borderColor = dark ? '#1a1d27' : '#fff'

  return {
    ...pieAnimation,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
      formatter: (p: { name?: string; value?: number; percent?: number }) =>
        `${p.name ?? ''}<br/>${p.value ?? 0} (${p.percent ?? 0}%)`,
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
        data: rows.value.map((row) => ({
          name: t(environmentI18nKey(row.env)),
          value: row.count,
          env: row.env,
          itemStyle: { color: environmentChartColor(row.env) },
        })),
      },
    ],
  }
})

function onClick(params: { dataIndex?: number }) {
  const row = rows.value[params.dataIndex ?? -1]
  if (row) emit('envClick', row.env)
}
</script>

<template>
  <div v-if="!hasData" class="flex h-[240px] items-center justify-center text-sm text-gray-400">
    {{ t('cockpit.chart.envBreakdownEmpty') }}
  </div>
  <VChart v-else class="h-[240px] w-full" :option="option" autoresize @click="onClick" />
</template>
