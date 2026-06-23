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
import { getKbGraphApi, getKbGraphEgoApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbGraph, KbGraphMeta, KbGraphMode } from '@/types/knowledge'

use([CanvasRenderer, GraphChart, TooltipComponent, TitleComponent, GraphicComponent])

const { t } = useI18n()
const { isDark } = useTheme()
const { selectedSpaceId, ensureSpacesLoaded, kbQuerySpaceId } = useKbSpace()

const loading = ref(false)
const expanding = ref(false)
const graph = ref<KbGraph>({ nodes: [], links: [] })
const meta = ref<KbGraphMeta | null>(null)
/** 已通过 ego 展开过的中心节点，避免重复请求 */
const expandedIds = ref<Set<string>>(new Set())

const previewOpen = ref(false)
const previewDocId = ref<number | string>()

const query = ref('')
/** 默认环形布局，大图下力导向会持续计算导致卡顿 */
const layout = ref<'force' | 'circular'>('circular')
const graphMode = ref<KbGraphMode>('summary')
const coreOnly = ref(false)
/** 被隐藏的 kb_type（图例点击切换），其余默认显示 */
const mutedTypes = ref<string[]>([])

const layoutOptions = computed(() => [
  { value: 'force', label: t('knowledge.graph.layoutForce') },
  { value: 'circular', label: t('knowledge.graph.layoutCircular') },
])

const modeOptions = computed(() => [
  { value: 'summary', label: t('knowledge.graph.modeSummary') },
  { value: 'full', label: t('knowledge.graph.modeFull') },
])

/** 超过该节点数视为大图：关掉持续力导画、关掉入场动画、强制环形布局 */
const BIG_GRAPH = 140
/** summary / full 客户端兜底裁剪上限（后端未升级时） */
const SUMMARY_CAP = 50
const FULL_CAP = 300
/** 「仅核心节点」时按度数保留的上限 */
const CORE_LIMIT = 60
/** 最多同时显示这么多标签，避免文字糊成一团 */
const LABEL_LIMIT = 28

const NODE_PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6']

/** 关系类型 → 边颜色 */
const RELATION_COLOR: Record<string, string> = {
  links_to: '#60a5fa',
  related: '#34d399',
  same_tag: '#fbbf24',
  depends_on: '#a78bfa',
  ref: '#22d3ee',
  contradiction: '#f87171',
  inference: '#c084fc',
}
/** 推断 / 矛盾关系用虚线区分 */
const DASHED_RELATIONS = new Set(['contradiction', 'inference'])

function nodeType(type?: string) {
  return type ?? 'other'
}

const allTypes = computed(() => [...new Set(graph.value.nodes.map((n) => nodeType(n.type)))])

const typeColor = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  allTypes.value.forEach((type, i) => {
    map[type] = NODE_PALETTE[i % NODE_PALETTE.length]
  })
  return map
})

const activeTypes = computed(() => allTypes.value.filter((tp) => !mutedTypes.value.includes(tp)))

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
  graph.value.links.filter((l) => visibleIds.value.has(l.source) && visibleIds.value.has(l.target)),
)

/** 度数阈值：只给度数最高的 LABEL_LIMIT 个节点显示标签 */
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

/** 大图强制环形，避免力导向持续物理仿真 */
const effectiveLayout = computed(() => (isBig.value ? 'circular' : layout.value))

const truncatedHint = computed(() => {
  if (!meta.value?.truncated) return ''
  return t('knowledge.graph.truncatedHint', {
    returned: meta.value.returnedNodes,
    total: meta.value.totalNodes,
  })
})

function toggleType(type: string) {
  const muted = new Set(mutedTypes.value)
  if (muted.has(type)) {
    muted.delete(type)
  } else {
    // 至少保留一种类型可见
    if (activeTypes.value.length <= 1) return
    muted.add(type)
  }
  mutedTypes.value = allTypes.value.filter((tp) => muted.has(tp))
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
    const type = l.type ?? 'related'
    const related = matched ? matched.has(l.source) || matched.has(l.target) : true
    return {
      source: l.source,
      target: l.target,
      name: type,
      lineStyle: {
        color: RELATION_COLOR[type] ?? (dark ? '#3f4252' : '#cbd5e1'),
        type: DASHED_RELATIONS.has(type) ? 'dashed' : 'solid',
        width: 1.3,
        opacity: matched ? (related ? 0.7 : 0.05) : 0.5,
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

/** 旧后端无 meta 时客户端按度数裁剪，避免一次渲染全库 */
function normalizeLoadedGraph(data: KbGraph, mode: KbGraphMode): KbGraph {
  const nodes = data.nodes ?? []
  const links = data.links ?? []
  if (data.meta) return { nodes, links, meta: data.meta }

  const cap = mode === 'summary' ? SUMMARY_CAP : FULL_CAP
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
    },
  }
}

async function loadGraph() {
  loading.value = true
  try {
    const res = await getKbGraphApi({
      spaceId: kbQuerySpaceId(),
      mode: graphMode.value,
      maxNodes: graphMode.value === 'summary' ? SUMMARY_CAP : FULL_CAP,
    })
    if (res.code === API_SUCCESS_CODE && res.data) {
      const normalized = normalizeLoadedGraph(res.data, graphMode.value)
      graph.value = { nodes: normalized.nodes, links: normalized.links }
      meta.value = normalized.meta ?? null
      expandedIds.value = new Set()
      mutedTypes.value = []
      if (normalized.nodes.length > BIG_GRAPH) layout.value = 'circular'
    }
  } finally {
    loading.value = false
  }
}

/** 合并 ego 返回的子图，返回新增节点数 */
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
  // 单击：展开邻居；双击：打开文档预览（用定时器区分）
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
  previewDocId.value = p.data.id
  previewOpen.value = true
}

watch(graphMode, () => loadGraph())

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
    <div class="flex flex-wrap items-center gap-2">
      <KbSpaceSelector />
      <button type="button" class="btn-ghost shrink-0" @click="loadGraph">
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.graph.refresh') }}
      </button>
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

      <label class="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input v-model="coreOnly" type="checkbox" class="h-4 w-4 rounded" />
        {{ t('knowledge.graph.coreOnly') }}
      </label>
    </div>

    <div
      v-if="truncatedHint"
      class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ truncatedHint }}</span>
    </div>

    <div v-if="allTypes.length" class="flex flex-wrap items-center gap-2">
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
          class="absolute inset-0 flex items-center justify-center text-sm text-gray-400"
        >
          {{ t('knowledge.graph.empty') }}
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
      {{ t('knowledge.graph.stats', { nodes: visibleNodes.length, links: visibleLinks.length }) }} · {{ t('knowledge.graph.tip') }}
    </p>

    <KbDocPreviewModal
      :open="previewOpen"
      :doc-id="previewDocId"
      @close="previewOpen = false"
    />
  </div>
</template>
