import { request } from '@/api/http'
import type { MoliResult } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  BiAnalyticsOverview,
  BiDashboardOverview,
  BiDrillRequest,
  BiDrillRow,
  BiQuery,
  BiReport,
  BiReportPreview,
} from '@/types/bi'
import {
  buildMockBiAnalytics,
  buildMockBiDashboard,
  buildMockBiDrillRows,
  buildMockBiReportPreview,
  buildMockBiReports,
} from '@/composables/biMock'

const USE_MOCK = import.meta.env.VITE_BI_MOCK !== 'false'

function buildQuery(params: BiQuery) {
  const qs = new URLSearchParams()
  qs.set('range', params.range)
  qs.set('period', params.period)
  for (const [key, on] of Object.entries(params.channels)) {
    if (on) qs.append('channel', key)
  }
  return `?${qs.toString()}`
}

function mockAnalytics(query: BiQuery) {
  return { code: API_SUCCESS_CODE, data: buildMockBiAnalytics(query) } satisfies MoliResult<BiAnalyticsOverview>
}

function mockDashboard(query: BiQuery) {
  return { code: API_SUCCESS_CODE, data: buildMockBiDashboard(query) } satisfies MoliResult<BiDashboardOverview>
}

export async function getBiAnalyticsApi(query: BiQuery): Promise<MoliResult<BiAnalyticsOverview>> {
  if (USE_MOCK) {
    await delay(280)
    return mockAnalytics(query)
  }
  try {
    const result = await request<BiAnalyticsOverview>(`/bi/analytics${buildQuery(query)}`, { method: 'GET' })
    if (result.code === API_SUCCESS_CODE && result.data) return result
  } catch {
    /* 后端未就绪时回退 Mock */
  }
  await delay(120)
  return mockAnalytics(query)
}

export async function getBiDashboardApi(query: BiQuery): Promise<MoliResult<BiDashboardOverview>> {
  if (USE_MOCK) {
    await delay(220)
    return mockDashboard(query)
  }
  try {
    const result = await request<BiDashboardOverview>(`/bi/dashboard${buildQuery(query)}`, { method: 'GET' })
    if (result.code === API_SUCCESS_CODE && result.data) return result
  } catch {
    /* 后端未就绪时回退 Mock */
  }
  await delay(100)
  return mockDashboard(query)
}

export async function getBiDrillApi(req: BiDrillRequest): Promise<MoliResult<BiDrillRow[]>> {
  if (USE_MOCK) {
    await delay(180)
    return { code: API_SUCCESS_CODE, data: buildMockBiDrillRows(req) }
  }
  try {
    const qs = new URLSearchParams({ metric: req.metric })
    qs.set('range', req.query.range)
    qs.set('period', req.query.period)
    for (const [key, on] of Object.entries(req.query.channels)) {
      if (on) qs.append('channel', key)
    }
    return await request<BiDrillRow[]>(`/bi/drill?${qs}`, { method: 'GET' })
  } catch {
    return { code: API_SUCCESS_CODE, data: buildMockBiDrillRows(req) }
  }
}

export async function getBiReportsApi(): Promise<MoliResult<BiReport[]>> {
  if (USE_MOCK) {
    await delay(160)
    return { code: API_SUCCESS_CODE, data: buildMockBiReports() }
  }
  try {
    return await request<BiReport[]>('/bi/reports', { method: 'GET' })
  } catch {
    return { code: API_SUCCESS_CODE, data: buildMockBiReports() }
  }
}

export async function getBiReportPreviewApi(reportId: string): Promise<MoliResult<BiReportPreview>> {
  if (USE_MOCK) {
    await delay(140)
    return { code: API_SUCCESS_CODE, data: buildMockBiReportPreview(reportId) }
  }
  try {
    return await request<BiReportPreview>(`/bi/reports/${reportId}/preview`, { method: 'GET' })
  } catch {
    return { code: API_SUCCESS_CODE, data: buildMockBiReportPreview(reportId) }
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
