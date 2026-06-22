<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent, TitleComponent } from 'echarts/components'
import { useTheme } from '@/composables/useTheme'
import { getKbGraphApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbGraph } from '@/types/knowledge'

use([CanvasRenderer, GraphChart, LegendComponent, TooltipComponent, TitleComponent])

const { t } = useI18n()
const { isDark } = useTheme()

const loading = ref(false)
const graph = ref<KbGraph>({ nodes: [], links: [] })

const palette = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444']

const categories = computed(() => [...new Set(graph.value.nodes.map((n) => n.type ?? 'other'))])

async function loadGraph() {
  loading.value = true
  try {
    const res = await getKbGraphApi()
    if (res.code === API_SUCCESS_CODE && res.data) graph.value = res.data
  } finally {
    loading.value = false
  }
}

const option = computed(() => {
  const dark = isDark.value
  const cats = categories.value
  const catIndex = (type?: string) => Math.max(0, cats.indexOf(type ?? 'other'))

  return {
    tooltip: {
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderWidth: 0,
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
      formatter: (p: { dataType: string; data: { name?: string; kbLabel?: string }; value?: number }) =>
        p.dataType === 'edge' ? (p.data.name ?? '') : (p.data.kbLabel ?? p.data.name ?? ''),
    },
    legend: cats.length
      ? { data: cats, textStyle: { color: dark ? '#9ca3af' : '#6b7280' }, top: 8 }
      : undefined,
    color: palette,
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories: cats.map((name) => ({ name })),
        label: { show: true, position: 'right', color: dark ? '#d1d5db' : '#374151', fontSize: 12 },
        force: { repulsion: 240, edgeLength: 130, gravity: 0.08 },
        lineStyle: { color: dark ? '#3f4252' : '#cbd5e1', curveness: 0.12, width: 1.4 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        data: graph.value.nodes.map((n) => ({
          id: n.id,
          name: n.title,
          kbLabel: `${n.title}（${n.type ?? 'other'}）`,
          symbolSize: 16 + (n.deg ?? 1) * 4,
          category: catIndex(n.type),
          itemStyle: { color: palette[catIndex(n.type) % palette.length] },
        })),
        links: graph.value.links.map((l) => ({ source: l.source, target: l.target, name: l.type })),
      },
    ],
  }
})

onMounted(() => loadGraph())
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title text-xl">{{ t('knowledge.graph.title') }}</h1>
        <p class="page-subtitle">{{ t('knowledge.graph.subtitle') }}</p>
      </div>
      <button type="button" class="btn-ghost shrink-0" @click="loadGraph">
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.graph.refresh') }}
      </button>
    </div>

    <div class="card p-2">
      <div class="relative h-[68vh] w-full">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-400">
          {{ t('common.loading') }}
        </div>
        <p v-else-if="!graph.nodes.length" class="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          {{ t('knowledge.graph.empty') }}
        </p>
        <VChart v-else :option="option" autoresize class="h-full w-full" />
      </div>
    </div>

    <p class="text-xs text-gray-400">{{ t('knowledge.graph.tip') }}</p>
  </div>
</template>
