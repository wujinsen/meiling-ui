export type CockpitTab = 'business' | 'ops'

export type CockpitRange = '7d' | '30d' | 'month' | 'quarter'

export type CockpitGranularity = 'day' | 'week' | 'month'

export type CockpitQuery = {
  tab: CockpitTab
  range: CockpitRange
  granularity: CockpitGranularity
  region?: string
  channel?: string
  environment?: number | ''
}

export type CockpitKpi = {
  key: string
  label: string
  value: string
  change?: string
  up?: boolean
  sub?: string
  drillMetric?: string
}

export type SeriesPoint = { label: string; actual: number; target: number }

export type PieItem = { name: string; value: number; drillKey?: string }

export type FunnelStage = {
  key: string
  stage: string
  desc: string
  count: number
  rate: string
  icon: 'users' | 'filter' | 'file' | 'handshake' | 'trophy'
}

export type OpsSummary = {
  projects: number
  servers: number
  platforms: number
  components: number
  envBreakdown: { env: number; count: number }[]
}

export type AlertItem = {
  id: string
  level: 'info' | 'warn' | 'error'
  text: string
  time: string
}

export type DrillRow = Record<string, string | number>

export type CockpitOverview = {
  refreshedAt: string
  kpis: CockpitKpi[]
  revenueTrend: SeriesPoint[]
  leadSources: PieItem[]
  funnel: FunnelStage[]
  ops: OpsSummary
  alerts: AlertItem[]
  topDeals: DrillRow[]
}

export type DrillRequest = {
  metric: string
  title: string
  filters: CockpitQuery
}
