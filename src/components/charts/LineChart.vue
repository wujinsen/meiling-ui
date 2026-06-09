<script setup lang="ts">

import { computed } from 'vue'

import { useI18n } from 'vue-i18n'

import { useTheme } from '@/composables/useTheme'

import { useChartReady } from '@/composables/useChartReady'

import { getDashboardChartData, getPulseChartData, type DashboardPeriod, type PulseRange } from '@/composables/useChartDatasets'

import VChart from 'vue-echarts'

import { use } from 'echarts/core'

import { CanvasRenderer } from 'echarts/renderers'

import { LineChart as ELineChart } from 'echarts/charts'

import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

import { chartAnimation } from '@/utils/chartAnimation'



use([CanvasRenderer, ELineChart, GridComponent, TooltipComponent, LegendComponent])



const props = withDefaults(

  defineProps<{

    multi?: boolean

    period?: DashboardPeriod

    range?: PulseRange

  }>(),

  { multi: false, period: 'monthly', range: '30D' }

)



const { isDark } = useTheme()

const { t } = useI18n()

const ready = useChartReady()



function seriesData(values: number[]) {

  return ready.value ? values : values.map(() => 0)

}



const option = computed(() => {

  const dark = isDark.value

  const textColor = dark ? '#9ca3af' : '#6b7280'

  const lineColor = dark ? '#374151' : '#e5e7eb'

  const revenue = t('chart.revenue')

  const dealValue = t('chart.dealValue')

  const target = t('chart.target')

  const users = t('chart.users')



  if (props.multi) {

    const data = getDashboardChartData(props.period)

    return {

      ...chartAnimation,

      grid: { left: 48, right: 48, top: 48, bottom: 32 },

      tooltip: { trigger: 'axis', backgroundColor: dark ? '#1a1d27' : '#fff', borderColor: dark ? '#374151' : '#e5e7eb', textStyle: { color: dark ? '#e5e7eb' : '#111' } },

      legend: { data: [revenue, dealValue, target], top: 4, textStyle: { color: textColor } },

      xAxis: { type: 'category', data: data.labels, axisLine: { lineStyle: { color: lineColor } }, axisLabel: { color: textColor } },

      yAxis: [

        { type: 'value', axisLabel: { color: textColor, formatter: '${value}k' }, splitLine: { lineStyle: { color: lineColor, type: 'dashed' } } },

        { type: 'value', axisLabel: { color: textColor }, splitLine: { show: false } },

      ],

      series: [

        { name: revenue, type: 'line', smooth: true, data: seriesData(data.revenue), animationDelay: 150, itemStyle: { color: '#8b5cf6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.25)' }, { offset: 1, color: 'rgba(139,92,246,0)' }] } } },

        { name: dealValue, type: 'line', smooth: true, data: seriesData(data.dealValue), animationDelay: 300, itemStyle: { color: '#3b82f6' } },

        { name: target, type: 'line', smooth: true, yAxisIndex: 1, data: seriesData(data.target), animationDelay: 450, itemStyle: { color: '#10b981' }, lineStyle: { type: 'dashed' } },

      ],

    }

  }



  const pulse = getPulseChartData(props.range)

  return {

    ...chartAnimation,

    grid: { left: 56, right: 56, top: 48, bottom: 32 },

    tooltip: { trigger: 'axis', backgroundColor: dark ? '#1a1d27' : '#fff', borderColor: dark ? '#374151' : '#e5e7eb', textStyle: { color: dark ? '#e5e7eb' : '#111' } },

    legend: { data: [revenue, users], top: 4, textStyle: { color: textColor } },

    xAxis: { type: 'category', data: pulse.labels, axisLine: { lineStyle: { color: lineColor } }, axisLabel: { color: textColor } },

    yAxis: [

      { type: 'value', name: '$', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: lineColor, type: 'dashed' } } },

      { type: 'value', name: '#', axisLabel: { color: textColor }, splitLine: { show: false } },

    ],

    series: [

      { name: revenue, type: 'line', smooth: true, yAxisIndex: 0, data: seriesData(pulse.revenue), animationDelay: 150, itemStyle: { color: '#a78bfa' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(167,139,250,0.3)' }, { offset: 1, color: 'rgba(167,139,250,0)' }] } } },

      { name: users, type: 'line', smooth: true, yAxisIndex: 1, data: seriesData(pulse.users), animationDelay: 350, itemStyle: { color: '#60a5fa' } },

    ],

  }

})

</script>



<template>

  <div class="chart-container h-[300px]">

    <VChart :key="`${multi}-${period}-${range}`" :option="option" autoresize class="h-full w-full" />

  </div>

</template>

