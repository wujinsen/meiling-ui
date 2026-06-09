import { request } from '@/api/http'
import type { MoliResult } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import type { CockpitOverview, CockpitQuery, DrillRequest, DrillRow } from '@/types/cockpit'
import { buildMockCockpitOverview, buildMockDrillRows } from '@/composables/cockpitMock'

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
  if (USE_MOCK) {
    await delay(320)
    return { code: API_SUCCESS_CODE, data: buildMockCockpitOverview(query) }
  }
  try {
    return await request<CockpitOverview>(`/cockpit/overview${buildQuery(query)}`, { method: 'GET' })
  } catch {
    return { code: API_SUCCESS_CODE, data: buildMockCockpitOverview(query) }
  }
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
