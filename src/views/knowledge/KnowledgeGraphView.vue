<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, RefreshCw, Search } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, TitleComponent, GraphicComponent } from 'echarts/components'
import { useTheme } from '@/composables/useTheme'
import { useKbSpace } from '@/composables/useKbSpace'
import { showToast } from '@/composables/useToast'
import KbDocPreviewModal from '@/components/knowledge/KbDocPreviewModal.vue'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import { getKbGraphApi, getKbGraphEgoApi, getKbWikiGraphApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbGraph, KbGraphMeta, KbGraphMode } from '@/types/knowledge'
import {
  KB_DASHED_RELATIONS,
  isEdgesJsonlType,
  relationColor,
} from '@/utils/kbGraphTheme'

use([CanvasRenderer, GraphChart, TooltipComponent, TitleComponent, GraphicComponent])

type GraphDataSource = 'relation' | 'wikiFile'

const { t } = useI18n()
const { isDark } = useTheme()
const { selectedSpaceId, ensureSpacesLoaded, kbQuerySpaceId } = useKbSpace()

const loading = ref(false)
const expanding = ref(false)
const graph = ref<KbGraph>({ nodes: [], links: [] })
const meta = ref<KbGraphMeta | null>(null)
const expandedIds = ref<Set<string>>(new Set())

const previewOpen = ref(false)
const previewDocId = ref<number | string>()
const previewSlug = ref<string>()

const query = ref('')
const layout = ref<'force' | 'circular'>('circular')
const graphMode = ref<KbGraphMode>('summary')
const coreOnly = ref(false)
const dataSource = ref<GraphDataSource>('relation')
const mutedTypes = ref<string[]>([])
const mutedRelationTypes = ref<string[]>([])

const layoutOptions = computed(() => [
  { value: 'force', label: t('knowledge.graph.layoutForce') },
  { value: 'circular', label: t('knowledge.graph.layoutCircular') },
])

const modeOptions = computed(() => [
  { value: 'summary', label: t('knowledge.graph.modeSummary') },
  { value: 'full', label: t('knowledge.graph.modeFull') },
])

const sourceOptions = computed(() => [
  { value: 'relation', label: t('knowledge.graph.sourceRelation') },
  { value: 'wikiFile', label: t('knowledge.graph.sourceWikiFile') },
])

const isWikiFileMode = computed(() => dataSource.value === 'wikiFile')

const BIG_GRAPH = 140
const SUMMARY_CAP = 50
const FULL_CAP = 300
const CORE_LIMIT = 60
const CORE_MIN_DEG = 1
const LABEL_LIMIT = 28

const NODE_PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6']

function nodeType(type?: string) {
  return type ?? 'other'
}

function linkType(type?: string) {
  return type ?? 'related'
}

const allTypes = computed(() => [...new Set(graph.value.nodes.map((n) => nodeType(n.type)))])

const allRelationTypes = computed(() => [
  ...new Set(graph.value.links.map((l) => linkType(l.type))),
])

const typeColor = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  allTypes.value.forEach((type, i) => {
    map[type] = NODE_PALETTE[i % NODE_PALETTE.length]
  })
  return map
})

const activeTypes = computed(() => allTypes.value.filter((tp) => !mutedTypes.value.includes(tp)))

const activeRelationTypes = computed(() =>
  allRelationTypes.value.filter((tp) => !mutedRelationTypes.value.includes(tp)),
)

const visibleNodes = computed(() => {
  const active = new Set(activeTypes.value)
  let ns = graph.value.nodes.filter((n) => active.has(nodeType(n.type)))
  if (coreOnly.value) {
    ns = [...ns].sort((a, b) => (b.deg ?? 0) - (a.deg ?? 0)).slice(0, CORE_LIMIT)
  }
  return ns
})

const visibleIds = computed(() => new Set(visibleNodes.value.map((n) => n.id)))

const visibleLinks = computed(() =>
  graph.value.links.filter(
    (l) =>
      visibleIds.value.has(l.source) &&
      visibleIds.value.has(l.target) &&
      activeRelationTypes.value.includes(linkType(l.type)),
  ),
)

const labelDegThreshold = computed(() => {
  const degs = visibleNodes.value.map((n) => n.deg ?? 0).sort((a, b) => b - a)
  if (degs.length <= LABEL_LIMIT) return -Infinity
  return degs[LABEL_LIMIT - 1]
})

const matchedIds = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return null
  return new Set(visibleNodes.value.filter((n) => n.title.toLowerCase().includes(q)).map((n) => n.id))
})

const isBig = computed(() => visibleNodes.value.length > BIG_GRAPH)

const effectiveLayout = computed(() => (isBig.value ? 'circular' : layout.value))

const truncatedHint = computed(() => {
  if (!meta.value?.truncated) return ''
  return t('knowledge.graph.truncatedHint', {
    returned: meta.value.returnedNodes,
    total: meta.value.totalNodes,
  })
})

const sourceBanner = computed(() => {
  const src = meta.value?.source
  if (!src) return ''
  if (src === 'wiki_file') return t('knowledge.graph.sourceBannerWikiFile')
  if (src === 'runtime') return t('knowledge.graph.sourceBannerRuntime')
  return t('knowledge.graph.sourceBannerRelation')
})

const edgesJsonlCount = computed(
  () => visibleLinks.value.filter((l) => isEdgesJsonlType(l.type)).length,
)

function toggleType(type: string) {
  const muted = new Set(mutedTypes.value)
  if (muted.has(type)) {
    muted.delete(type)
  } else if (activeTypes.value.length <= 1) {
    return
  } else {
    muted.add(type)
  }
  mutedTypes.value = allTypes.value.filter((tp) => muted.has(tp))
}

function toggleRelationType(type: string) {
  const muted = new Set(mutedRelationTypes.value)
  if (muted.has(type)) {
    muted.delete(type)
  } else if (activeRelationTypes.value.length <= 1) {
    return
  } else {
    muted.add(type)
  }
  mutedRelationTypes.value = allRelationTypes.value.filter((tp) => muted.has(tp))
}

function relationLabel(type: string) {
  const key = `knowledge.graph.relation.${type}`
  const translated = t(key)
  return translated === key ? type : translated
}

const option = computed(() => {
  const dark = isDark.value
  const matched = matchedIds.value
  const threshold = labelDegThreshold.value
  const big = isBig.value
  const chartLayout = effectiveLayout.value

  const nodes = visibleNodes.value.map((n) => {
    const dimmed = matched ? !matched.has(n.id) : false
    const showLabel = matched ? matched.has(n.id) : (n.deg ?? 0) >= threshold
    const color = typeColor.value[nodeType(n.type)]
    const expanded = expandedIds.value.has(n.id)
    return {
      id: n.id,
      name: n.title,
      kbLabel: `${n.title}（${nodeType(n.type)} · ${t('knowledge.graph.degree')} ${n.deg ?? 0}）`,
      symbolSize: Math.min(54, 14 + (n.deg ?? 1) * 4),
      itemStyle: {
        color,
        opacity: dimmed ? 0.12 : 1,
        borderColor: expanded ? (dark ? '#e5e7eb' : '#111827') : dark ? '#0f1117' : '#fff',
        borderWidth: expanded ? 2 : 1,
      },
      label: {
        show: showLabel && !dimmed,
        position: 'right',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
      },
    }
  })

  const links = visibleLinks.value.map((l) => {
    const type = linkType(l.type)
    const related = matched ? matched.has(l.source) || matched.has(l.target) : true
    return {
      source: l.source,
      target: l.target,
      name: relationLabel(type),
      lineStyle: {
        color: relationColor(type, dark),
        type: KB_DASHED_RELATIONS.has(type) ? 'dashed' : 'solid',
        width: isEdgesJsonlType(type) ? 1.8 : 1.3,
        opacity: matched ? (related ? 0.75 : 0.05) : 0.55,
        curveness: 0.12,
      },
    }
  })

  return {
    animation: !big,
    tooltip: {
      backgroundColor: dark ? '#1a1d27' : '#fff',
      borderWidth: 0,
      textStyle: { color: dark ? '#e5e7eb' : '#111' },
      formatter: (p: { dataType: string; data: { name?: string; kbLabel?: string } }) =>
        p.dataType === 'edge' ? (p.data.name ?? '') : (p.data.kbLabel ?? p.data.name ?? ''),
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
        force: { repulsion: big ? 120 : 240, edgeLength: big ? 80 : 130, gravity: 0.08, layoutAnimation: !big },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        ...(big ? {} : { labelLayout: { hideOverlap: true } }),
        data: nodes,
        links,
      },
    ],
  }
})

function normalizeLoadedGraph(data: KbGraph, mode: KbGraphMode, maxNodes?: number): KbGraph {
  const nodes = data.nodes ?? []
  const links = data.links ?? []
  if (data.meta) return { nodes, links, meta: data.meta }

  const cap = maxNodes ?? (mode === 'summary' ? SUMMARY_CAP : FULL_CAP)
  if (nodes.length <= cap) return { nodes, links, meta: data.meta }

  const sorted = [...nodes].sort((a, b) => (b.deg ?? 0) - (a.deg ?? 0)).slice(0, cap)
  const keep = new Set(sorted.map((n) => n.id))
  const croppedLinks = links.filter((l) => keep.has(l.source) && keep.has(l.target))
  return {
    nodes: sorted,
    links: croppedLinks,
    meta: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      returnedNodes: sorted.length,
      returnedLinks: croppedLinks.length,
      truncated: true,
      mode,
      source: isWikiFileMode.value ? 'wiki_file' : 'relation',
    },
  }
}

function applyGraphData(data: KbGraph, mode: KbGraphMode, maxNodes: number) {
  const normalized = normalizeLoadedGraph(data, mode, maxNodes)
  graph.value = { nodes: normalized.nodes, links: normalized.links }
  meta.value = normalized.meta ?? null
  expandedIds.value = new Set()
  mutedTypes.value = []
  mutedRelationTypes.value = []
  if (normalized.nodes.length > BIG_GRAPH) layout.value = 'circular'
}

async function loadGraph() {
  if (isWikiFileMode.value && selectedSpaceId.value == null) {
    graph.value = { nodes: [], links: [] }
    meta.value = null
    return
  }

  loading.value = true
  try {
    const maxNodes = coreOnly.value
      ? CORE_LIMIT
      : graphMode.value === 'summary'
        ? SUMMARY_CAP
        : FULL_CAP
    const minDeg = coreOnly.value ? CORE_MIN_DEG : undefined

    if (isWikiFileMode.value) {
      const res = await getKbWikiGraphApi({
        spaceId: selectedSpaceId.value!,
        mode: graphMode.value,
        maxNodes,
        minDeg,
      })
      if (res.code === API_SUCCESS_CODE && res.data) {
        applyGraphData(res.data, graphMode.value, maxNodes)
      } else {
        showToast('error', res.msg || t('knowledge.graph.wikiFileFailed'))
      }
      return
    }

    const res = await getKbGraphApi({
      spaceId: kbQuerySpaceId(),
      mode: graphMode.value,
      maxNodes,
      minDeg,
    })
    if (res.code === API_SUCCESS_CODE && res.data) {
      applyGraphData(res.data, graphMode.value, maxNodes)
    }
  } catch (e) {
    if (isWikiFileMode.value) {
      const msg = e instanceof Error ? e.message : ''
      showToast('error', msg.includes('404') || msg.includes('Invalid response')
        ? t('knowledge.graph.wikiFileFailed')
        : (msg || t('knowledge.graph.wikiFileFailed')))
    }
  } finally {
    loading.value = false
  }
}

function mergeGraph(incoming: KbGraph): number {
  const nodeMap = new Map(graph.value.nodes.map((n) => [n.id, { ...n }]))
  let added = 0
  for (const n of incoming.nodes ?? []) {
    const existing = nodeMap.get(n.id)
    if (!existing) {
      nodeMap.set(n.id, { ...n })
      added += 1
    } else if ((n.deg ?? 0) > (existing.deg ?? 0)) {
      existing.deg = n.deg
    }
  }
  const linkKey = (l: { source: string; target: string; type?: string }) =>
    `${l.source}->${l.target}:${l.type ?? ''}`
  const linkSet = new Set(graph.value.links.map(linkKey))
  const links = [...graph.value.links]
  for (const l of incoming.links ?? []) {
    const k = linkKey(l)
    if (!linkSet.has(k)) {
      linkSet.add(k)
      links.push(l)
    }
  }
  graph.value = { nodes: [...nodeMap.values()], links }
  return added
}

async function expandNode(id: string) {
  if (isWikiFileMode.value) {
    showToast('success', t('knowledge.graph.wikiFileNoEgo'))
    return
  }
  if (expanding.value || expandedIds.value.has(id)) return
  expanding.value = true
  try {
    const res = await getKbGraphEgoApi(id, { spaceId: kbQuerySpaceId(), depth: 1 })
    if (res.code === API_SUCCESS_CODE && res.data) {
      const added = mergeGraph(res.data)
      expandedIds.value = new Set([...expandedIds.value, id])
      if (graph.value.nodes.length > BIG_GRAPH) layout.value = 'circular'
      showToast(
        'success',
        added > 0
          ? t('knowledge.graph.expandedOk', { count: added })
          : t('knowledge.graph.noMoreNeighbors'),
      )
    } else {
      showToast('error', t('knowledge.graph.egoFailed'))
    }
  } catch {
    showToast('error', t('knowledge.graph.egoFailed'))
  } finally {
    expanding.value = false
  }
}

let clickTimer: ReturnType<typeof setTimeout> | null = null

function onChartClick(params: unknown) {
  const p = params as { dataType?: string; data?: { id?: string } }
  if (p.dataType !== 'node' || !p.data?.id) return
  const id = p.data.id
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = setTimeout(() => {
    void expandNode(id)
    clickTimer = null
  }, 240)
}

function onChartDblClick(params: unknown) {
  const p = params as { dataType?: string; data?: { id?: string } }
  if (p.dataType !== 'node' || !p.data?.id) return
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
  previewDocId.value = isWikiFileMode.value ? undefined : p.data.id
  previewSlug.value = isWikiFileMode.value ? p.data.id : undefined
  previewOpen.value = true
}

watch(graphMode, () => loadGraph())
watch(coreOnly, () => loadGraph())
watch(dataSource, () => loadGraph())

watch(
  () => visibleNodes.value.length,
  (count) => {
    if (count > BIG_GRAPH) layout.value = 'circular'
  },
)

onMounted(async () => {
  await ensureSpacesLoaded()
  await loadGraph()
})

watch(selectedSpaceId, () => loadGraph())
</script>

<template>
  <div class="page-stack">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.graph.subtitle') }}</p>

    <div class="flex flex-wrap items-center gap-2">
      <KbSpaceSelector :hide-all-option="isWikiFileMode" />
      <SegmentControl
        :model-value="dataSource"
        :options="sourceOptions"
        @update:model-value="dataSource = $event as GraphDataSource"
      />
      <button type="button" class="btn-ghost shrink-0" @click="loadGraph">
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.graph.refresh') }}
      </button>
    </div>

    <div
      v-if="sourceBanner"
      class="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ sourceBanner }}</span>
    </div>

    <div
      v-if="isWikiFileMode && selectedSpaceId == null"
      class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      {{ t('knowledge.graph.pickSpaceForWikiFile') }}
    </div>

    <div class="card flex flex-wrap items-center gap-3 p-3">
      <div class="relative min-w-[200px] flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('knowledge.graph.searchPlaceholder')"
          class="field-input h-9 w-full pl-9"
        />
      </div>

      <SegmentControl
        :model-value="graphMode"
        :options="modeOptions"
        @update:model-value="graphMode = $event as KbGraphMode"
      />

      <SegmentControl
        :model-value="layout"
        :options="layoutOptions"
        @update:model-value="layout = $event as 'force' | 'circular'"
      />

      <AppCheckbox v-model="coreOnly" variant="option">
        {{ t('knowledge.graph.coreOnly') }}
      </AppCheckbox>
    </div>

    <div
      v-if="truncatedHint"
      class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ truncatedHint }}</span>
    </div>

    <div v-if="allTypes.length" class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-gray-400">{{ t('knowledge.graph.nodeTypes') }}</span>
      <button
        v-for="type in allTypes"
        :key="type"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
        :class="
          activeTypes.includes(type)
            ? 'border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
            : 'border-gray-200 text-gray-400 opacity-60 dark:border-gray-700'
        "
        @click="toggleType(type)"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: typeColor[type] }" />
        {{ type }}
      </button>
    </div>

    <div v-if="allRelationTypes.length" class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-gray-400">{{ t('knowledge.graph.relationTypes') }}</span>
      <button
        v-for="type in allRelationTypes"
        :key="type"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
        :class="
          activeRelationTypes.includes(type)
            ? 'border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
            : 'border-gray-200 text-gray-400 opacity-60 dark:border-gray-700'
        "
        @click="toggleRelationType(type)"
      >
        <span
          class="h-2.5 w-2.5 rounded-full"
          :style="{ backgroundColor: relationColor(type, isDark) }"
        />
        {{ relationLabel(type) }}
      </button>
    </div>

    <div class="card p-2">
      <div class="relative h-[64vh] w-full">
        <div
          v-if="loading"
          class="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-400"
        >
          {{ t('common.loading') }}
        </div>
        <p
          v-else-if="!graph.nodes.length"
          class="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center text-sm text-gray-400"
        >
          <span>{{ isWikiFileMode ? t('knowledge.graph.emptyWikiFile') : t('knowledge.graph.empty') }}</span>
          <span v-if="!isWikiFileMode" class="text-xs">{{ t('knowledge.graph.emptySyncHint') }}</span>
        </p>
        <VChart
          v-else
          :option="option"
          autoresize
          class="h-full w-full"
          @click="onChartClick"
          @dblclick="onChartDblClick"
        />
        <div
          v-if="expanding"
          class="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs text-gray-500 shadow-sm dark:bg-gray-800/90 dark:text-gray-300"
        >
          <RefreshCw class="h-3.5 w-3.5 animate-spin" /> {{ t('knowledge.graph.expanding') }}
        </div>
      </div>
    </div>

    <p class="text-xs text-gray-400">
      {{ t('knowledge.graph.stats', { nodes: visibleNodes.length, links: visibleLinks.length }) }}
      <template v-if="edgesJsonlCount > 0">
        · {{ t('knowledge.graph.edgesJsonlStats', { count: edgesJsonlCount }) }}
      </template>
      · {{ isWikiFileMode ? t('knowledge.graph.tipWikiFile') : t('knowledge.graph.tip') }}
    </p>

    <KbDocPreviewModal
      :open="previewOpen"
      :doc-id="previewDocId"
      :slug="previewSlug"
      :space-id="selectedSpaceId ?? undefined"
      :wiki-file="isWikiFileMode"
      @close="previewOpen = false"
    />
  </div>
</template>
