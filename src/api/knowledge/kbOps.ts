import { request } from '@/api/http'
import type {
  KbOpsDashboardVo,
  KbOpsEvalRun,
  KbOpsEvalTrendPoint,
} from '@/types/knowledge'
import { KB_BASE, USE_MOCK, buildQuery, delay, ok } from './core'

function mockDashboard(): KbOpsDashboardVo {
  const today = new Date().toISOString().slice(0, 10)
  return {
    syncTrend: [{ date: today, successBatches: 2, failBatches: 0 }],
    lintSummary: {
      openCount: 2,
      openByType: { broken_link: 1, orphan: 1 },
      topBrokenLinks: ['mock broken'],
    },
    unresolvedRelationCount: 3,
    llm: {
      enabled: true,
      available: true,
      provider: 'mock',
      model: 'mock',
      callLogEnabled: true,
      trendDays: 7,
      totalCalls: 40,
      successCalls: 36,
      failCalls: 4,
      successRate: 0.9,
      failRate: 0.1,
      cacheHitRate: 0.25,
      estimatedCostUsd: 0.128,
      estimatedCostSavedUsd: 0.041,
      callsByScene: { ask: 28, ingest: 12 },
      costTrend: [
        { date: today, estimatedCostUsd: 0.032, cacheHits: 3, calls: 10 },
      ],
    },
    retrievalQuality: {
      goldenTotal: 48,
      strategies: [
        {
          strategy: 'ngram',
          hit3: 0.7917,
          mrr: 0.642,
          baselineHit3: 0.7917,
          deltaHit3: 0,
          gatePass: true,
          latestRunAt: `${today}T08:00:00`,
          errors: 0,
          p95Ms: 120,
        },
        {
          strategy: 'hybrid',
          hit3: 0.8958,
          mrr: 0.71,
          baselineHit3: 0.8958,
          deltaHit3: 0,
          gatePass: true,
          latestRunAt: `${today}T08:10:00`,
          errors: 0,
          p95Ms: 280,
        },
        {
          strategy: 'hybrid-rerank',
          hit3: 0.8125,
          mrr: 0.68,
          baselineHit3: 0.8333,
          deltaHit3: -0.0208,
          gatePass: false,
          latestRunAt: `${today}T08:20:00`,
          errors: 1,
          p95Ms: 410,
        },
      ],
    },
    driftSummary: {
      drifted: true,
      wikiOnlyTotal: 4,
      dbOnlyTotal: 1,
      hashMismatchTotal: 2,
      inSyncTotal: 80,
      spacesWithDrift: 1,
      spacesScanned: 2,
      checkedAt: `${today}T09:00:00`,
      spaces: [
        {
          spaceId: '900000000000000001',
          spaceCode: 'enterprise-kb',
          drifted: true,
          wikiOnlyCount: 4,
          dbOnlyCount: 1,
          hashMismatchCount: 2,
          inSyncCount: 40,
        },
      ],
    },
  }
}

export async function getKbOpsDashboardApi(params?: { spaceId?: number | string; trendDays?: number }) {
  if (USE_MOCK) {
    await delay(280)
    return ok<KbOpsDashboardVo>(mockDashboard())
  }
  return request<KbOpsDashboardVo>(
    `${KB_BASE}/ops/dashboard${buildQuery({
      spaceId: params?.spaceId,
      trendDays: params?.trendDays,
    })}`,
    { method: 'GET', timeoutMs: 12_000 },
  )
}

/** GET /kb/ops/eval-trend — 检索质量日趋势（点击策略后懒加载） */
export async function getKbOpsEvalTrendApi(params?: { strategy?: string; days?: number }) {
  if (USE_MOCK) {
    await delay(180)
    const today = new Date().toISOString().slice(0, 10)
    return ok<KbOpsEvalTrendPoint[]>([
      { date: today, strategy: params?.strategy || 'ngram', hit3: 0.79, mrr: 0.64 },
    ])
  }
  return request<KbOpsEvalTrendPoint[]>(
    `${KB_BASE}/ops/eval-trend${buildQuery({
      strategy: params?.strategy,
      days: params?.days,
    })}`,
    { method: 'GET' },
  )
}

/** GET /kb/ops/eval-runs — 评测 run 明细（点击策略后懒加载） */
export async function getKbOpsEvalRunsApi(params?: { strategy?: string; limit?: number }) {
  if (USE_MOCK) {
    await delay(180)
    const today = new Date().toISOString().slice(0, 10)
    return ok<KbOpsEvalRun[]>([
      {
        id: 1,
        runAt: `${today}T08:00:00`,
        strategy: params?.strategy || 'ngram',
        hit3: 0.7917,
        mrr: 0.642,
        errors: 0,
        p95Ms: 120,
        gatePass: true,
        goldenTotal: 48,
      },
    ])
  }
  return request<KbOpsEvalRun[]>(
    `${KB_BASE}/ops/eval-runs${buildQuery({
      strategy: params?.strategy,
      limit: params?.limit,
    })}`,
    { method: 'GET' },
  )
}
