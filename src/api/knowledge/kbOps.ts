import { request } from '@/api/http'
import type { KbOpsDashboardVo } from '@/types/knowledge'
import { KB_BASE, USE_MOCK, buildQuery, delay, ok } from './core'

export async function getKbOpsDashboardApi(params?: { spaceId?: number | string; trendDays?: number }) {
  if (USE_MOCK) {
    await delay(280)
    const today = new Date().toISOString().slice(0, 10)
    return ok<KbOpsDashboardVo>({
      syncTrend: [{ date: today, successBatches: 2, failBatches: 0 }],
      lintSummary: {
        openCount: 2,
        openByType: { broken_link: 1, orphan: 1 },
        topBrokenLinks: ['mock broken'],
      },
      unresolvedRelationCount: 0,
      llm: { enabled: true, available: true, provider: 'mock', model: 'mock' },
    })
  }
  return request<KbOpsDashboardVo>(
    `${KB_BASE}/ops/dashboard${buildQuery({
      spaceId: params?.spaceId,
      trendDays: params?.trendDays,
    })}`,
    { method: 'GET' },
  )
}
