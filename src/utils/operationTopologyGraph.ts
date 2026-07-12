import type {
  OperationTopologyGraph,
  OperationTopologyLink,
  OperationTopologyServerNode,
} from '@/types/operation'
import { HEALTH_DOWN, HEALTH_SKIPPED, HEALTH_UP } from '@/utils/operationHealth'

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

export function buildTopologyEchartsData(
  graph: ReturnType<typeof filterTopologyGraph>,
  focusId?: string,
) {
  type NodeRow = {
    id: string
    name: string
    kind: 'server' | 'project' | 'component'
    symbolSize: number
    itemStyle: { color: string; borderColor?: string; borderWidth?: number }
    symbol: string
    label: { show: boolean }
  }

  const nodes: NodeRow[] = [
    ...graph.servers.map((s) => ({
      id: s.id,
      name: s.serverName || s.ip || s.id,
      kind: 'server' as const,
      symbolSize: topologyNodeSize('server'),
      itemStyle: {
        color: topologyNodeColor('server', s),
        borderColor: focusId === s.id ? '#7c3aed' : undefined,
        borderWidth: focusId === s.id ? 3 : undefined,
      },
      symbol: topologyNodeSymbol('server'),
      label: { show: true },
    })),
    ...graph.projects.map((p) => ({
      id: p.id,
      name: p.projectName || p.id,
      kind: 'project' as const,
      symbolSize: topologyNodeSize('project'),
      itemStyle: {
        color: topologyNodeColor('project', p),
        borderColor: focusId === p.id ? '#7c3aed' : undefined,
        borderWidth: focusId === p.id ? 3 : undefined,
      },
      symbol: topologyNodeSymbol('project'),
      label: { show: true },
    })),
    ...graph.components.map((c) => ({
      id: c.id,
      name: c.componentName || c.id,
      kind: 'component' as const,
      symbolSize: topologyNodeSize('component'),
      itemStyle: {
        color: topologyNodeColor('component', c),
        borderColor: focusId === c.id ? '#7c3aed' : undefined,
        borderWidth: focusId === c.id ? 3 : undefined,
      },
      symbol: topologyNodeSymbol('component'),
      label: { show: true },
    })),
  ]

  const links = graph.links.map((l: OperationTopologyLink) => ({
    source: l.source,
    target: l.target,
    lineStyle: {
      type: l.type === 'depends_on' ? 'dashed' : 'solid',
      color: '#94a3b8',
    },
  }))

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
