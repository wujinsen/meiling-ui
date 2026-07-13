<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { RefreshCw, Search } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
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
  buildTopologyEntitySearchHits,
  filterTopologyGraph,
  parseTopologyFocus,
  topologyLinkTypes,
  topologyStats,
  type TopologyEntitySearchHit,
  type TopologyGraphFilters,
} from '@/utils/operationTopologyGraph'
import { topologyLinkColor } from '@/utils/operationTopologyTheme'

use([CanvasRenderer, GraphChart, TooltipComponent])

const { t } = useI18n()
const { isDark } = useTheme()
const route = useRoute()

const loading = ref(false)
const lastRefreshedAt = ref('')
const rawGraph = ref<OperationTopologyGraph>({ servers: [], projects: [], components: [], links: [] })
const entitySearch = ref('')
const environment = ref<number | ''>('')
const serverRole = ref<string | ''>('')
const tag = ref<string | ''>('')
const layout = ref<'force' | 'circular'>('force')
const tagOptions = ref<string[]>([])
const focusId = ref('')
const entitySearchOpen = ref(false)
const mutedKinds = ref<Array<'server' | 'project' | 'component'>>([])
const mutedLinkTypes = ref<string[]>([])

const BIG_GRAPH = 80
const LABEL_LIMIT = 24

const NODE_KIND_COLORS: Record<'server' | 'project' | 'component', string> = {
  server: '#3b82f6',
  project: '#6366f1',
  component: '#8b5cf6',
}

const nodeKinds = ['server', 'project', 'component'] as const

const entitySearchHits = computed(() => buildTopologyEntitySearchHits(rawGraph.value, entitySearch.value))

const groupedEntityHits = computed(() => {
  const groups: Record<'server' | 'project' | 'component', TopologyEntitySearchHit[]> = {
    server: [],
    project: [],
    component: [],
  }
  for (const hit of entitySearchHits.value) groups[hit.kind].push(hit)
  return groups
})

const showEntitySearch = computed(() => entitySearchOpen.value && entitySearch.value.trim().length > 0)

const relationOpen = ref(false)
const relationType = ref<'server' | 'project' | 'component'>('server')
const relationId = ref<number | string | null>(null)

const serverDetailOpen = ref(false)
const serverDetailId = ref<number | string | null>(null)

const filters = computed<TopologyGraphFilters>(() => ({
  environment: environment.value,
  serverRole: serverRole.value,
  tag: tag.value,
}))

const filtered = computed(() => filterTopologyGraph(rawGraph.value, filters.value))
const stats = computed(() => topologyStats(filtered.value))

const allLinkTypes = computed(() => topologyLinkTypes(filtered.value.links))

const activeKinds = computed(() => nodeKinds.filter((k) => !mutedKinds.value.includes(k)))

const activeLinkTypes = computed(() => allLinkTypes.value.filter((t) => !mutedLinkTypes.value.includes(t)))

const matchedIds = computed(() => {
  const q = entitySearch.value.trim().toLowerCase()
  if (!q) return null
  const ids = new Set<string>()
  for (const s of filtered.value.servers) {
    if ([s.serverName, s.ip, s.innerIp, ...(s.tags ?? [])].some((f) => f?.toLowerCase().includes(q))) ids.add(s.id)
  }
  for (const p of filtered.value.projects) {
    if ([p.projectName, p.port].some((f) => f?.toLowerCase().includes(q))) ids.add(p.id)
  }
  for (const c of filtered.value.components) {
    if ([c.componentName, c.port, c.version].some((f) => f?.toLowerCase().includes(q))) ids.add(c.id)
  }
  return ids
})

const isBig = computed(() => {
  const g = filtered.value
  return g.servers.length + g.projects.length + g.components.length > BIG_GRAPH
})

const effectiveLayout = computed(() => (isBig.value ? 'circular' : layout.value))

const layoutOptions = computed(() => [
  { value: 'force', label: t('operation.topology.layoutForce') },
  { value: 'circular', label: t('operation.topology.layoutCircular') },
])

const tagFilterOptions = computed(() => [
  { value: '', label: t('operation.serverTags.all') },
  ...tagOptions.value.map((value) => ({ value, label: value })),
])

const chartOption = computed(() => {
  const dark = isDark.value
  const chartLayout = effectiveLayout.value
  const big = isBig.value
  const { nodes, links } = buildTopologyEchartsData(filtered.value, {
    dark,
    focusId: focusId.value || undefined,
    matchedIds: matchedIds.value,
    labelLimit: LABEL_LIMIT,
    mutedKinds: new Set(mutedKinds.value),
    mutedLinkTypes: new Set(mutedLinkTypes.value),
  })

  return {
    animation: !big,
    tooltip: {
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderWidth: 0,
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
      formatter: (p: { dataType: string; data: { name?: string; topoLabel?: string } }) =>
        p.dataType === 'edge'
          ? relationLabel((p.data as { name?: string }).name ?? '')
          : (p.data.topoLabel ?? p.data.name ?? ''),
    },
    series: [
      {
        type: 'graph',
        layout: chartLayout,
        roam: true,
        draggable: chartLayout === 'force' && !big,
        large: big,
        largeThreshold: BIG_GRAPH,
        circular: { rotateLabel: true },
        force: {
          repulsion: big ? 120 : 240,
          edgeLength: big ? 80 : 130,
          gravity: 0.08,
          layoutAnimation: !big,
        },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        ...(big ? {} : { labelLayout: { hideOverlap: true } }),
        lineStyle: { curveness: 0.12 },
        data: nodes,
        links,
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
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    lastRefreshedAt.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
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
  focusEntity(id)
}

function focusEntity(id: string) {
  focusId.value = id
  entitySearchOpen.value = false
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

function entityGroupLabel(kind: 'server' | 'project' | 'component') {
  if (kind === 'server') return t('operation.topology.entityGroupServer')
  if (kind === 'project') return t('operation.topology.entityGroupProject')
  return t('operation.topology.entityGroupComponent')
}

function nodeKindLabel(kind: 'server' | 'project' | 'component') {
  return entityGroupLabel(kind)
}

function relationLabel(type: string) {
  const key = `operation.topology.relation.${type}`
  const translated = t(key)
  return translated === key ? type : translated
}

function toggleNodeKind(kind: 'server' | 'project' | 'component') {
  const muted = new Set(mutedKinds.value)
  if (muted.has(kind)) {
    muted.delete(kind)
  } else if (activeKinds.value.length <= 1) {
    return
  } else {
    muted.add(kind)
  }
  mutedKinds.value = nodeKinds.filter((k) => muted.has(k))
}

function toggleLinkType(type: string) {
  const muted = new Set(mutedLinkTypes.value)
  if (muted.has(type)) {
    muted.delete(type)
  } else if (activeLinkTypes.value.length <= 1) {
    return
  } else {
    muted.add(type)
  }
  mutedLinkTypes.value = allLinkTypes.value.filter((tp) => muted.has(tp))
}

function onEntitySearchBlur() {
  window.setTimeout(() => {
    entitySearchOpen.value = false
  }, 150)
}

function onEntitySearchPick(hit: TopologyEntitySearchHit) {
  entitySearch.value = hit.label
  focusEntity(hit.id)
}

watch(entitySearch, (value) => {
  entitySearchOpen.value = Boolean(value.trim())
})

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
  <div class="page-shell operation-topology-page">
    <OperationPageHeader :title="t('operation.topology.title')" :subtitle="t('operation.topology.subtitle')" />

    <section class="card operation-topology-toolbar">
      <label class="relative min-w-[14rem] flex-1">
        <span class="sr-only">{{ t('operation.common.search') }}</span>
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="entitySearch"
          type="search"
          class="field-input h-10 w-full pl-9"
          :placeholder="t('operation.topology.searchPlaceholder')"
          @focus="entitySearchOpen = Boolean(entitySearch.trim())"
          @blur="onEntitySearchBlur"
        />
        <div v-if="showEntitySearch" class="operation-topology-entity-search">
          <template v-for="kind in (['server', 'project', 'component'] as const)" :key="kind">
            <template v-if="groupedEntityHits[kind].length">
              <div class="operation-topology-entity-search__group">{{ entityGroupLabel(kind) }}</div>
              <button
                v-for="hit in groupedEntityHits[kind]"
                :key="hit.id"
                type="button"
                class="operation-topology-entity-search__item"
                @mousedown.prevent="onEntitySearchPick(hit)"
              >
                <span class="font-medium text-gray-800 dark:text-gray-100">{{ hit.label }}</span>
                <span v-if="hit.sublabel" class="text-xs text-gray-400">{{ hit.sublabel }}</span>
              </button>
            </template>
          </template>
          <p v-if="!entitySearchHits.length" class="operation-topology-entity-search__empty">{{ t('operation.topology.searchEmpty') }}</p>
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
      <button
        type="button"
        class="operation-toolbar-refresh ml-auto"
        :disabled="loading"
        :title="lastRefreshedAt ? t('operation.topology.refreshedAt', { time: lastRefreshedAt }) : undefined"
        @click="loadGraph"
      >
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
        {{ loading ? t('operation.common.loading') : t('operation.common.refresh') }}
      </button>
    </section>

    <section class="card operation-topology-filters">
      <div class="operation-topology-legend-row">
        <span class="operation-topology-legend-label">{{ t('operation.topology.nodeTypes') }}</span>
        <div class="operation-topology-chip-group">
          <button
            v-for="kind in nodeKinds"
            :key="kind"
            type="button"
            class="operation-toggle-chip"
            :class="{ 'operation-toggle-chip--off': !activeKinds.includes(kind) }"
            :aria-pressed="activeKinds.includes(kind)"
            @click="toggleNodeKind(kind)"
          >
            <span class="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" :style="{ backgroundColor: NODE_KIND_COLORS[kind] }" />
            {{ nodeKindLabel(kind) }}
          </button>
        </div>
      </div>

      <div v-if="allLinkTypes.length" class="operation-topology-legend-row">
        <span class="operation-topology-legend-label">{{ t('operation.topology.relationTypes') }}</span>
        <div class="operation-topology-chip-group">
          <button
            v-for="type in allLinkTypes"
            :key="type"
            type="button"
            class="operation-toggle-chip"
            :class="{ 'operation-toggle-chip--off': !activeLinkTypes.includes(type) }"
            :aria-pressed="activeLinkTypes.includes(type)"
            @click="toggleLinkType(type)"
          >
            <span class="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" :style="{ backgroundColor: topologyLinkColor(type, isDark) }" />
            {{ relationLabel(type) }}
          </button>
        </div>
      </div>

      <div class="operation-topology-stats">
        <p class="operation-topology-stats__summary">
          {{ t('operation.topology.stats', stats) }}
        </p>
        <p v-if="stats.downServers" class="operation-topology-stats__alert">
          {{ t('operation.topology.downServers', { n: stats.downServers }) }}
        </p>
        <p v-if="lastRefreshedAt" class="operation-topology-stats__time">
          {{ t('operation.topology.refreshedAt', { time: lastRefreshedAt }) }}
        </p>
      </div>
    </section>

    <section class="card operation-topology-chart-card">
      <div class="relative h-[64vh] w-full min-h-[20rem]">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-400">
          {{ t('operation.common.loading') }}
        </div>
        <p
          v-else-if="!filtered.servers.length && !filtered.projects.length && !filtered.components.length"
          class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-gray-400"
        >
          {{ t('operation.topology.empty') }}
        </p>
        <VChart v-else class="h-full w-full" :option="chartOption" autoresize @click="onChartClick" />
      </div>
    </section>

    <p class="operation-topology-tip">{{ t('operation.topology.tip') }}</p>

    <ServerDetailModal :open="serverDetailOpen" :server-id="serverDetailId" @close="serverDetailOpen = false" />
    <RelationDrawer
      :open="relationOpen"
      :entity-type="relationType"
      :entity-id="relationId"
      :show-edit-links="false"
      @close="relationOpen = false"
      @edit-links="relationOpen = false"
    />
  </div>
</template>
