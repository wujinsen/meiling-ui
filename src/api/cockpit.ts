import { request } from '@/api/http'
import type { MoliResult } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import type { CockpitOverview, CockpitQuery, DrillRequest, DrillRow } from '@/types/cockpit'
import { buildMockCockpitOverview, buildMockDrillRows } from '@/composables/cockpitMock'
import { getOperationStatsApi } from '@/api/operation'
import type { OperationStats } from '@/types/operation'

const USE_MOCK = import.meta.env.VITE_COCKPIT_MOCK !== 'false'

function buildQuery(params: CockpitQuery) {
  const qs = new URLSearchParams()
  qs.set('tab', params.tab)
  qs.set('range', params.range)
  qs.set('granularity', params.granularity)
  if (params.region) qs.set('region', params.region)
  if (params.channel) qs.set('channel', params.channel)
  if (params.environment !== undefined && params.environment !== '') qs.set('environment', String(params.environment))
  return `?${qs.toString()}`
}

export async function getCockpitOverviewApi(query: CockpitQuery): Promise<MoliResult<CockpitOverview>> {
  let overview: CockpitOverview
  if (USE_MOCK) {
    await delay(320)
    overview = buildMockCockpitOverview(query)
  } else {
    try {
      const result = await request<CockpitOverview>(`/cockpit/overview${buildQuery(query)}`, { method: 'GET' })
      if (result.code === API_SUCCESS_CODE && result.data) {
        overview = result.data
      } else {
        overview = buildMockCockpitOverview(query)
      }
    } catch {
      overview = buildMockCockpitOverview(query)
    }
  }

  if (query.tab === 'ops') {
    await mergeOperationStats(overview)
  }
  return { code: API_SUCCESS_CODE, data: overview }
}

export async function getCockpitDrillApi(req: DrillRequest): Promise<MoliResult<DrillRow[]>> {
  if (USE_MOCK) {
    await delay(200)
    return { code: API_SUCCESS_CODE, data: buildMockDrillRows(req) }
  }
  try {
    const qs = new URLSearchParams({ metric: req.metric })
    return await request<DrillRow[]>(`/cockpit/drill${qs}`, { method: 'GET' })
  } catch {
    return { code: API_SUCCESS_CODE, data: buildMockDrillRows(req) }
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function mergeOperationStats(overview: CockpitOverview) {
  try {
    const result = await getOperationStatsApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) return
    applyStats(overview, result.data)
  } catch {
    // keep mock / partial overview
  }
}

function applyStats(overview: CockpitOverview, stats: OperationStats) {
  overview.ops = {
    projects: stats.projects ?? overview.ops?.projects ?? 0,
    servers: stats.servers ?? overview.ops?.servers ?? 0,
    platforms: stats.platforms ?? overview.ops?.platforms ?? 0,
    components: stats.components ?? overview.ops?.components ?? 0,
    envBreakdown: stats.envBreakdown ?? overview.ops?.envBreakdown ?? [],
  }

  const mismatch = stats.portMismatches ?? 0
  const down = stats.healthDown ?? 0
  overview.kpis = overview.kpis.map((kpi) => {
    if (kpi.key === 'projects') return { ...kpi, value: String(stats.projects ?? kpi.value) }
    if (kpi.key === 'servers') return { ...kpi, value: String(stats.servers ?? kpi.value) }
    if (kpi.key === 'components') return { ...kpi, value: String(stats.components ?? kpi.value) }
    if (kpi.key === 'platforms') return { ...kpi, value: String(stats.platforms ?? kpi.value) }
    if (kpi.key === 'alerts') return { ...kpi, value: String(mismatch + down), change: mismatch > 0 ? `+${mismatch}` : kpi.change }
    return kpi
  })
}
