import type {
  OperationTopologyGraph,
  OperationTopologyLink,
  OperationTopologyServerNode,
} from '@/types/operation'
import { TOPOLOGY_DASHED_LINKS, topologyLinkColor } from '@/utils/operationTopologyTheme'
import { HEALTH_DOWN, HEALTH_SKIPPED, HEALTH_UP } from '@/utils/operationHealth'

export type TopologyChartBuildOptions = {
  dark?: boolean
  focusId?: string
  matchedIds?: Set<string> | null
  labelLimit?: number
  mutedKinds?: Set<'server' | 'project' | 'component'>
  mutedLinkTypes?: Set<string>
}

export type TopologyGraphFilters = {
  environment?: number | ''
  serverRole?: string | ''
  tag?: string | ''
  keyword?: string
}

export function topologyNodeColor(kind: 'server' | 'project' | 'component', node: {
  status?: number | null
  deployRunning?: boolean | null
}) {
  if (kind === 'project') {
    if (node.deployRunning === true) return '#10b981'
    if (node.deployRunning === false) return '#9ca3af'
    return '#6366f1'
  }
  switch (node.status) {
    case HEALTH_UP:
      return '#10b981'
    case HEALTH_DOWN:
      return '#ef4444'
    case HEALTH_SKIPPED:
      return '#f59e0b'
    default:
      return '#9ca3af'
  }
}

export function topologyNodeSymbol(kind: 'server' | 'project' | 'component') {
  if (kind === 'server') return 'roundRect'
  if (kind === 'project') return 'circle'
  return 'diamond'
}

export function topologyNodeSize(kind: 'server' | 'project' | 'component') {
  if (kind === 'server') return 42
  if (kind === 'project') return 34
  return 28
}

function matchKeyword(text: string, keyword: string) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  return text.toLowerCase().includes(q)
}

function serverSearchText(s: OperationTopologyServerNode) {
  return [s.serverName, s.ip, s.innerIp, ...(s.tags ?? [])].filter(Boolean).join(' ')
}

export function filterTopologyGraph(graph: OperationTopologyGraph, filters: TopologyGraphFilters) {
  const keyword = filters.keyword ?? ''
  const env = filters.environment
  const role = filters.serverRole
  const tag = filters.tag

  const servers = (graph.servers ?? []).filter((s) => {
    if (env !== '' && env != null && s.environment !== env) return false
    if (role && s.serverRole !== role) return false
    if (tag && !(s.tags ?? []).includes(tag)) return false
    if (!matchKeyword(serverSearchText(s), keyword)) return false
    return true
  })
  const projects = (graph.projects ?? []).filter((p) => {
    if (env !== '' && env != null && p.environment !== env) return false
    if (!matchKeyword(p.projectName ?? '', keyword)) return false
    return true
  })
  const components = (graph.components ?? []).filter((c) => {
    if (env !== '' && env != null && c.environment !== env) return false
    if (!matchKeyword([c.componentName, c.port, c.version].filter(Boolean).join(' '), keyword)) return false
    return true
  })

  const nodeIds = new Set([
    ...servers.map((s) => s.id),
    ...projects.map((p) => p.id),
    ...components.map((c) => c.id),
  ])

  const links = (graph.links ?? []).filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target))

  return { servers, projects, components, links }
}

export function computeTopologyDegrees(links: OperationTopologyLink[]) {
  const deg = new Map<string, number>()
  for (const link of links) {
    deg.set(link.source, (deg.get(link.source) ?? 0) + 1)
    deg.set(link.target, (deg.get(link.target) ?? 0) + 1)
  }
  return deg
}

function labelDegThreshold(degrees: Map<string, number>, nodeIds: string[], labelLimit: number) {
  const degs = nodeIds.map((id) => degrees.get(id) ?? 0).sort((a, b) => b - a)
  if (degs.length <= labelLimit) return -Infinity
  return degs[labelLimit - 1]
}

export function topologyLinkTypes(links: OperationTopologyLink[]) {
  return [...new Set(links.map((l) => l.type ?? 'deploys'))]
}

export function buildTopologyEchartsData(
  graph: ReturnType<typeof filterTopologyGraph>,
  options: TopologyChartBuildOptions = {},
) {
  const dark = options.dark ?? false
  const focusId = options.focusId
  const matched = options.matchedIds
  const labelLimit = options.labelLimit ?? 24
  const mutedKinds = options.mutedKinds ?? new Set()
  const mutedLinkTypes = options.mutedLinkTypes ?? new Set()

  const degrees = computeTopologyDegrees(graph.links)
  const nodeIds = [
    ...graph.servers.map((s) => s.id),
    ...graph.projects.map((p) => p.id),
    ...graph.components.map((c) => c.id),
  ]
  const degThreshold = labelDegThreshold(degrees, nodeIds, labelLimit)

  type NodeRow = {
    id: string
    name: string
    kind: 'server' | 'project' | 'component'
    topoLabel: string
    symbolSize: number
    itemStyle: { color: string; opacity: number; borderColor: string; borderWidth: number }
    symbol: string
    label: { show: boolean; position: string; color: string; fontSize: number }
  }

  function buildNode(
    id: string,
    name: string,
    kind: 'server' | 'project' | 'component',
    statusNode: { status?: number | null; deployRunning?: boolean | null },
    sublabel?: string,
  ): NodeRow | null {
    if (mutedKinds.has(kind)) return null
    const deg = degrees.get(id) ?? 0
    const dimmed = matched ? !matched.has(id) : false
    const focused = focusId === id
    const showLabel = matched ? matched.has(id) : focused || deg >= degThreshold
    const baseSize = topologyNodeSize(kind)
    return {
      id,
      name,
      kind,
      topoLabel: sublabel ? `${name}（${sublabel} · ${deg}）` : `${name}（${deg}）`,
      symbolSize: Math.min(baseSize + 12, baseSize + deg * 3),
      itemStyle: {
        color: topologyNodeColor(kind, statusNode),
        opacity: dimmed ? 0.12 : 1,
        borderColor: focused ? (dark ? '#e5e7eb' : '#111827') : dark ? '#0f1117' : '#fff',
        borderWidth: focused ? 2 : 1,
      },
      symbol: topologyNodeSymbol(kind),
      label: {
        show: showLabel && !dimmed,
        position: 'right',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
      },
    }
  }

  const nodes: NodeRow[] = []
  for (const s of graph.servers) {
    const row = buildNode(s.id, s.serverName || s.ip || s.id, 'server', s, 'server')
    if (row) nodes.push(row)
  }
  for (const p of graph.projects) {
    const row = buildNode(p.id, p.projectName || p.id, 'project', p, 'project')
    if (row) nodes.push(row)
  }
  for (const c of graph.components) {
    const row = buildNode(c.id, c.componentName || c.id, 'component', c, 'component')
    if (row) nodes.push(row)
  }

  const visibleIds = new Set(nodes.map((n) => n.id))
  const links = graph.links
    .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
    .filter((l) => !mutedLinkTypes.has(l.type ?? 'deploys'))
    .map((l: OperationTopologyLink) => {
      const type = l.type ?? 'deploys'
      const related = matched ? matched.has(l.source) || matched.has(l.target) : true
      return {
        source: l.source,
        target: l.target,
        name: type,
        lineStyle: {
          type: TOPOLOGY_DASHED_LINKS.has(type) ? 'dashed' : 'solid',
          color: topologyLinkColor(type, dark),
          width: type === 'depends_on' ? 1.3 : 1.8,
          opacity: matched ? (related ? 0.75 : 0.05) : 0.55,
          curveness: 0.12,
        },
      }
    })

  return { nodes, links }
}

export function parseTopologyFocus(raw?: string | null, serverId?: string | null) {
  if (raw) {
    if (/^[spc]-\d+$/i.test(raw)) return raw.toLowerCase()
    if (/^\d+$/.test(raw)) return `s-${raw}`
    return raw
  }
  if (serverId) return `s-${serverId}`
  return ''
}

export function topologyStats(graph: ReturnType<typeof filterTopologyGraph>) {
  const downServers = graph.servers.filter((s) => s.status === HEALTH_DOWN).length
  return {
    servers: graph.servers.length,
    projects: graph.projects.length,
    components: graph.components.length,
    downServers,
  }
}

export type TopologyEntitySearchHit = {
  id: string
  label: string
  sublabel?: string
  kind: 'server' | 'project' | 'component'
}

function matchesTopologyKeyword(keyword: string, ...fields: Array<string | undefined | null>) {
  const q = keyword.trim().toLowerCase()
  if (!q) return false
  return fields.some((field) => field?.toLowerCase().includes(q))
}

export function buildTopologyEntitySearchHits(
  graph: OperationTopologyGraph,
  keyword: string,
  limitPerKind = 8,
): TopologyEntitySearchHit[] {
  const q = keyword.trim()
  if (!q) return []

  const hits: TopologyEntitySearchHit[] = []
  const servers = graph.servers ?? []
  const projects = graph.projects ?? []
  const components = graph.components ?? []

  for (const srv of servers) {
    if (!srv.id) continue
    if (!matchesTopologyKeyword(q, srv.serverName, srv.ip, srv.innerIp, ...(srv.tags ?? []))) continue
    hits.push({
      id: `s-${srv.id}`,
      kind: 'server',
      label: srv.serverName || srv.ip || String(srv.id),
      sublabel: srv.innerIp || srv.ip || undefined,
    })
    if (hits.filter((h) => h.kind === 'server').length >= limitPerKind) break
  }

  for (const project of projects) {
    if (!project.id) continue
    if (!matchesTopologyKeyword(q, project.projectName, project.port)) continue
    hits.push({
      id: `p-${project.id}`,
      kind: 'project',
      label: project.projectName || String(project.id),
      sublabel: project.port || undefined,
    })
    if (hits.filter((h) => h.kind === 'project').length >= limitPerKind) break
  }

  for (const component of components) {
    if (!component.id) continue
    if (!matchesTopologyKeyword(q, component.componentName, component.port, component.version)) continue
    hits.push({
      id: `c-${component.id}`,
      kind: 'component',
      label: component.componentName || String(component.id),
      sublabel: component.version || component.port || undefined,
    })
    if (hits.filter((h) => h.kind === 'component').length >= limitPerKind) break
  }

  return hits
}
