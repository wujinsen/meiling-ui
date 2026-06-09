export type BiRange = '7d' | '30d' | 'month' | 'quarter'

export type BiPeriod = 'weekly' | 'monthly' | 'quarterly'

export type BiChannelKey = 'referrals' | 'organic' | 'social' | 'paidAds' | 'direct'

export type BiChannels = Record<BiChannelKey, boolean>

export type BiQuery = {
  range: BiRange
  period: BiPeriod
  channels: BiChannels
}

export type BiKpi = {
  key: string
  labelKey: string
  value: string
  subKey?: string
  change?: string
  up?: boolean
  drillMetric?: string
}

export type BiTrendBar = {
  labels: string[]
  values: number[]
  targetLine: number
  highlightIndex?: number
}

export type BiPieItem = {
  nameKey: string
  value: number
  count: number
}

export type BiFunnelStage = {
  key: string
  stageKey: string
  descKey: string
  count: number
  rate: string
  icon: 'users' | 'filter' | 'file' | 'handshake' | 'trophy'
}

export type BiTopDeal = {
  company: string
  logo: string
  logoBg: string
  dealValue: string
  created: number
  won: number
  probability: number
  statusKey: string
  statusClass: string
  owner: string
}

export type BiTeamMember = {
  name: string
  roleKey: string
  avatar: string
  deals: number
}

export type BiRecentDeal = {
  titleKey: string
  companyKey: string
  date: string
  value: string
  progress: number
  progressColor: string
  statusKey: string
  statusClass: string
}

export type BiTask = {
  titleKey: string
  typeKey: string
  priority: 'high' | 'medium' | 'low'
  assignees: number
  dateKey: string
}

export type BiAnalyticsOverview = {
  refreshedAt: string
  kpis: BiKpi[]
  trend: BiTrendBar
  activities: BiPieItem[]
  activityTotal: number
  targetPercent: number
  targetLeftKey: string
  funnel: BiFunnelStage[]
  topDeals: BiTopDeal[]
  team: BiTeamMember[]
}

export type BiDashboardOverview = {
  refreshedAt: string
  kpis: BiKpi[]
  leadSources: BiPieItem[]
  recentDeals: BiRecentDeal[]
  tasks: BiTask[]
}

export type BiReportFormat = 'table' | 'chart' | 'mixed'

export type BiReport = {
  id: string
  categoryKey: string
  titleKey: string
  descKey: string
  periodKey: string
  format: BiReportFormat
  updatedAt: string
}

export type BiReportPreview = {
  reportId: string
  columns: string[]
  rows: Record<string, string | number>[]
  summary?: string
}

export type BiDrillRequest = {
  metric: string
  title: string
  query: BiQuery
}

export type BiDrillRow = Record<string, string | number>
