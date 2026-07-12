<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { RefreshCw, Search } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import { getServerTagOptionsApi, getTopologyGraphApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import RelationDrawer from '@/components/operation/RelationDrawer.vue'
import ServerDetailModal from '@/components/operation/ServerDetailModal.vue'
import ServerRoleSelect from '@/components/operation/ServerRoleSelect.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import { useTheme } from '@/composables/useTheme'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationTopologyGraph } from '@/types/operation'
import {
  buildTopologyEchartsData,
  filterTopologyGraph,
  parseTopologyFocus,
  topologyStats,
  type TopologyGraphFilters,
} from '@/utils/operationTopologyGraph'

use([CanvasRenderer, GraphChart, TooltipComponent, ToolboxComponent, GraphicComponent])

const { t } = useI18n()
const { isDark } = useTheme()
const route = useRoute()

const loading = ref(false)
const rawGraph = ref<OperationTopologyGraph>({ servers: [], projects: [], components: [], links: [] })
const keyword = ref('')
const environment = ref<number | ''>('')
const serverRole = ref<string | ''>('')
const tag = ref<string | ''>('')
const layout = ref<'force' | 'circular'>('force')
const tagOptions = ref<string[]>([])
const focusId = ref('')

const relationOpen = ref(false)
const relationType = ref<'server' | 'project' | 'component'>('server')
const relationId = ref<number | string | null>(null)

const serverDetailOpen = ref(false)
const serverDetailId = ref<number | string | null>(null)

const filters = computed<TopologyGraphFilters>(() => ({
  keyword: keyword.value,
  environment: environment.value,
  serverRole: serverRole.value,
  tag: tag.value,
}))

const filtered = computed(() => filterTopologyGraph(rawGraph.value, filters.value))
const stats = computed(() => topologyStats(filtered.value))

const layoutOptions = computed(() => [
  { value: 'force', label: t('operation.topology.layoutForce') },
  { value: 'circular', label: t('operation.topology.layoutCircular') },
])

const tagFilterOptions = computed(() => [
  { value: '', label: t('operation.serverTags.all') },
  ...tagOptions.value.map((value) => ({ value, label: value })),
])

const chartOption = computed(() => {
  const { nodes, links } = buildTopologyEchartsData(filtered.value, focusId.value || undefined)
  const textColor = isDark.value ? '#e5e7eb' : '#374151'
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    toolbox: {
      show: true,
      feature: { saveAsImage: { title: t('operation.topology.exportPng') } },
      iconStyle: { borderColor: textColor },
    },
    series: [
      {
        type: 'graph',
        layout: layout.value,
        roam: true,
        draggable: true,
        data: nodes,
        links,
        label: {
          show: true,
          color: textColor,
          fontSize: 11,
        },
        lineStyle: { curveness: 0.12, opacity: 0.75 },
        emphasis: { focus: 'adjacency' },
        force: { repulsion: 220, edgeLength: [80, 160] },
      },
    ],
  }
})

async function loadGraph() {
  loading.value = true
  try {
    const result = await getTopologyGraphApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.topology.loadFailed'))
    }
    rawGraph.value = result.data
    syncFocusFromRoute()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.topology.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function loadTagOptions() {
  try {
    const result = await getServerTagOptionsApi()
    if (result.code === API_SUCCESS_CODE && result.data) tagOptions.value = result.data
  } catch {
    tagOptions.value = []
  }
}

function syncFocusFromRoute() {
  const focus = parseTopologyFocus(
    typeof route.query.focus === 'string' ? route.query.focus : null,
    typeof route.query.serverId === 'string' ? route.query.serverId : null,
  )
  focusId.value = focus
}

function onChartClick(params: unknown) {
  const data = (params as { data?: { id?: string } })?.data
  const id = data?.id
  if (!id) return
  focusId.value = id
  if (id.startsWith('s-')) {
    const numericId = id.slice(2)
    serverDetailId.value = numericId
    serverDetailOpen.value = true
    return
  }
  if (id.startsWith('p-')) {
    relationType.value = 'project'
    relationId.value = id.slice(2)
    relationOpen.value = true
    return
  }
  if (id.startsWith('c-')) {
    relationType.value = 'component'
    relationId.value = id.slice(2)
    relationOpen.value = true
  }
}

watch(
  () => route.query.focus,
  () => syncFocusFromRoute(),
)

onMounted(() => {
  void loadTagOptions()
  void loadGraph()
})
</script>

<template>
  <div>
    <OperationPageHeader :title="t('operation.topology.title')" :subtitle="t('operation.topology.subtitle')">
      <template #toolbar>
        <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadGraph">
          <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
          {{ t('operation.common.refresh') }}
        </button>
      </template>
    </OperationPageHeader>

    <div class="card space-y-4 p-5">
      <div class="flex flex-wrap items-end gap-3">
        <label class="operation-filter-field min-w-[12rem] flex-1">
          <span>{{ t('operation.common.search') }}</span>
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input v-model="keyword" type="search" class="field-input pl-9" :placeholder="t('operation.topology.searchPlaceholder')" />
          </div>
        </label>
        <div class="operation-filter-field">
          <span>{{ t('operation.common.environment') }}</span>
          <EnvironmentSelect v-model="environment" include-all />
        </div>
        <div class="operation-filter-field">
          <span>{{ t('operation.serverRole.label') }}</span>
          <ServerRoleSelect v-model="serverRole" include-all />
        </div>
        <div class="operation-filter-field">
          <span>{{ t('operation.serverTags.label') }}</span>
          <AppSelect v-model="tag" :options="tagFilterOptions" />
        </div>
        <SegmentControl v-model="layout" :options="layoutOptions" />
      </div>

      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('operation.topology.stats', stats) }}
        <span v-if="stats.downServers" class="ml-2 text-red-600 dark:text-red-400">
          {{ t('operation.topology.downServers', { n: stats.downServers }) }}
        </span>
      </p>

      <div v-if="loading" class="py-16 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
      <div v-else-if="!filtered.servers.length && !filtered.projects.length && !filtered.components.length" class="py-16 text-center text-gray-400">
        {{ t('operation.topology.empty') }}
      </div>
      <VChart v-else class="operation-topology-chart" :option="chartOption" autoresize @click="onChartClick" />
    </div>

    <ServerDetailModal :open="serverDetailOpen" :server-id="serverDetailId" @close="serverDetailOpen = false" />
    <RelationDrawer
      :open="relationOpen"
      :entity-type="relationType"
      :entity-id="relationId"
      @close="relationOpen = false"
      @edit-links="relationOpen = false"
    />
  </div>
</template>

<style scoped>
.operation-topology-chart {
  height: min(70vh, 640px);
  width: 100%;
}
</style>
