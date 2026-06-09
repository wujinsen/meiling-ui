import type {
  BiAnalyticsOverview,
  BiChannels,
  BiDashboardOverview,
  BiDrillRequest,
  BiDrillRow,
  BiQuery,
  BiReport,
  BiReportPreview,
} from '@/types/bi'

const rangeScale: Record<BiQuery['range'], number> = {
  '7d': 0.38,
  '30d': 0.72,
  month: 1,
  quarter: 1.25,
}

const channelWeights: { key: keyof BiChannels; nameKey: string; weight: number }[] = [
  { key: 'referrals', nameKey: 'chart.leadSources.referrals', weight: 28 },
  { key: 'organic', nameKey: 'chart.leadSources.organic', weight: 24 },
  { key: 'social', nameKey: 'chart.leadSources.social', weight: 18 },
  { key: 'paidAds', nameKey: 'chart.leadSources.paidAds', weight: 14 },
  { key: 'direct', nameKey: 'chart.leadSources.direct', weight: 10 },
]

function enabledChannelCount(channels: BiChannels) {
  return Object.values(channels).filter(Boolean).length
}

function channelFactor(channels: BiChannels) {
  const n = enabledChannelCount(channels)
  return n === 0 ? 0.15 : n / channelWeights.length
}

function buildLeadSources(query: BiQuery) {
  const scale = rangeScale[query.range] * channelFactor(query.channels)
  const items = channelWeights
    .filter((c) => query.channels[c.key])
    .map((c) => ({
      nameKey: c.nameKey,
      value: c.weight,
      count: Math.round(c.weight * 18 * scale),
    }))
  const total = items.reduce((s, i) => s + i.value, 0) || 1
  return items.map((i) => ({
    ...i,
    value: Math.round((i.value / total) * 100),
  }))
}

function buildTrend(query: BiQuery) {
  const labels =
    query.period === 'weekly'
      ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
      : query.period === 'quarterly'
        ? ['Q1', 'Q2', 'Q3', 'Q4']
        : ['1月', '2月', '3月', '4月', '5月', '6月']

  const scale = rangeScale[query.range] * channelFactor(query.channels)
  const values = labels.map((_, i) => Math.round((120 + i * 28) * scale))
  const highlightIndex = query.period === 'monthly' ? 3 : Math.floor(labels.length / 2)
  return {
    labels,
    values,
    targetLine: Math.round(180 * scale),
    highlightIndex,
  }
}

export function buildMockBiAnalytics(query: BiQuery): BiAnalyticsOverview {
  const scale = rangeScale[query.range] * channelFactor(query.channels)
  const activityTotal = Math.round(2122 * scale)

  return {
    refreshedAt: new Date().toISOString(),
    kpis: [
      { key: 'won', labelKey: 'analytics.kpis.dealsWon.label', value: String(Math.round(425 * scale)), subKey: 'analytics.kpis.dealsWon.sub', change: '+5.2%', up: true, drillMetric: 'won' },
      { key: 'leads', labelKey: 'analytics.kpis.activeLeads.label', value: Math.round(1847 * scale).toLocaleString(), subKey: 'analytics.kpis.activeLeads.sub', change: '+14%', up: true, drillMetric: 'leads' },
      { key: 'winRate', labelKey: 'analytics.kpis.winRate.label', value: `${(32.8 * (0.9 + channelFactor(query.channels) * 0.1)).toFixed(1)}%`, subKey: 'analytics.kpis.winRate.sub', change: '+1.2%', up: true, drillMetric: 'winRate' },
      { key: 'revenue', labelKey: 'analytics.kpis.totalRevenue.label', value: `$${Math.round(350 * scale)}k`, subKey: 'analytics.kpis.totalRevenue.sub', change: '+12.4%', up: true, drillMetric: 'revenue' },
    ],
    trend: buildTrend(query),
    activities: [
      { nameKey: 'chart.activities.calls', value: 50, count: Math.round(1061 * scale) },
      { nameKey: 'chart.activities.emails', value: 30, count: Math.round(637 * scale) },
      { nameKey: 'chart.activities.meetings', value: 11, count: Math.round(233 * scale) },
      { nameKey: 'chart.activities.tasks', value: 9, count: Math.round(191 * scale) },
    ],
    activityTotal,
    targetPercent: Math.min(98, Math.round(84.3 * (0.85 + channelFactor(query.channels) * 0.15) * 10) / 10),
    targetLeftKey: 'analytics.revenueTarget.left',
    funnel: [
      { key: 'leads', stageKey: 'analytics.funnel.leads', descKey: 'analytics.funnel.leadsDesc', count: Math.round(1847 * scale), rate: '100%', icon: 'users' },
      { key: 'qualified', stageKey: 'analytics.funnel.qualified', descKey: 'analytics.funnel.qualifiedDesc', count: Math.round(924 * scale), rate: '50%', icon: 'filter' },
      { key: 'proposal', stageKey: 'analytics.funnel.proposal', descKey: 'analytics.funnel.proposalDesc', count: Math.round(462 * scale), rate: '25%', icon: 'file' },
      { key: 'negotiation', stageKey: 'analytics.funnel.negotiation', descKey: 'analytics.funnel.negotiationDesc', count: Math.round(231 * scale), rate: '12.5%', icon: 'handshake' },
      { key: 'won', stageKey: 'analytics.funnel.closedWon', descKey: 'analytics.funnel.closedWonDesc', count: Math.round(116 * scale), rate: '6.3%', icon: 'trophy' },
    ],
    topDeals: buildTopDeals(scale),
    team: [
      { name: 'Sebastian Gray', roleKey: 'analytics.team.salesExecutive', avatar: 'SG', deals: Math.round(42 * scale) },
      { name: 'Emily Chen', roleKey: 'analytics.team.accountExecutive', avatar: 'EC', deals: Math.round(38 * scale) },
      { name: 'Marcus Johnson', roleKey: 'analytics.team.salesManager', avatar: 'MJ', deals: Math.round(35 * scale) },
      { name: 'Priya Patel', roleKey: 'analytics.team.accountManager', avatar: 'PP', deals: Math.round(31 * scale) },
    ],
  }
}

function buildTopDeals(scale: number) {
  return [
    { company: 'Stripe', logo: 'S', logoBg: 'bg-indigo-500', dealValue: '$70.0M', created: 12, won: 8, probability: 92, statusKey: 'analytics.dealStatus.proposal', statusClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', owner: 'John Smith' },
    { company: 'dzen.ru', logo: 'D', logoBg: 'bg-sky-500', dealValue: '$42.5M', created: 9, won: 5, probability: 78, statusKey: 'analytics.dealStatus.negotiation', statusClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', owner: 'John Smith' },
    { company: 'Invision', logo: 'I', logoBg: 'bg-pink-500', dealValue: '$28.0M', created: 7, won: 4, probability: 65, statusKey: 'analytics.dealStatus.discovery', statusClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300', owner: 'John Smith' },
    { company: 'Google', logo: 'G', logoBg: 'bg-red-500', dealValue: '$12.0B', created: Math.round(6 * scale) || 1, won: 3, probability: 85, statusKey: 'analytics.dealStatus.active', statusClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', owner: 'John Smith' },
    { company: 'TikTok', logo: 'T', logoBg: 'bg-gray-900', dealValue: '$9.8M', created: 4, won: 1, probability: 33, statusKey: 'analytics.dealStatus.lead', statusClass: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400', owner: 'John Smith' },
    { company: 'Salesforce', logo: 'SF', logoBg: 'bg-cyan-600', dealValue: '$4.2M', created: 3, won: 0, probability: 20, statusKey: 'analytics.dealStatus.lost', statusClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', owner: 'John Smith' },
  ]
}

export function buildMockBiDashboard(query: BiQuery): BiDashboardOverview {
  const scale = rangeScale[query.range]
  const sources = buildLeadSources(query)

  return {
    refreshedAt: new Date().toISOString(),
    kpis: [
      { key: 'leads', labelKey: 'dashboard.kpis.totalLeads.label', value: String(Math.round(377 * scale)), subKey: 'dashboard.kpis.totalLeads.sub' },
      { key: 'deals', labelKey: 'dashboard.kpis.activeDeals.label', value: String(Math.round(467 * scale)), subKey: 'dashboard.kpis.activeDeals.sub', drillMetric: 'deals' },
      { key: 'won', labelKey: 'dashboard.kpis.wonDeals.label', value: String(Math.round(122 * scale)), subKey: 'dashboard.kpis.wonDeals.sub' },
      { key: 'revenue', labelKey: 'dashboard.kpis.totalRevenue.label', value: `$${Math.round(350 * scale)}k`, subKey: 'dashboard.kpis.totalRevenue.sub', drillMetric: 'revenue' },
    ],
    leadSources: sources.length ? sources : [{ nameKey: 'chart.leadSources.other', value: 100, count: 0 }],
    recentDeals: [
      { titleKey: 'dashboard.deals.enterprise.title', companyKey: 'dashboard.deals.enterprise.company', date: '今天', value: '$35k', progress: 75, progressColor: 'bg-violet-500', statusKey: 'dashboard.dealStatus.new', statusClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
      { titleKey: 'dashboard.deals.support.title', companyKey: 'dashboard.deals.support.company', date: '昨天', value: '$12k', progress: 60, progressColor: 'bg-blue-500', statusKey: 'dashboard.dealStatus.contacted', statusClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
      { titleKey: 'dashboard.deals.upgrade.title', companyKey: 'dashboard.deals.upgrade.company', date: '3月12日', value: '$48k', progress: 45, progressColor: 'bg-amber-500', statusKey: 'dashboard.dealStatus.negotiation', statusClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    ],
    tasks: [
      { titleKey: 'dashboard.taskItems.followUp.title', typeKey: 'taskType.call', priority: 'high', assignees: 2, dateKey: 'common.today' },
      { titleKey: 'dashboard.taskItems.proposal.title', typeKey: 'taskType.email', priority: 'medium', assignees: 1, dateKey: 'common.tomorrow' },
      { titleKey: 'dashboard.taskItems.contract.title', typeKey: 'taskType.review', priority: 'low', assignees: 3, dateKey: 'dashboard.taskItems.contract.dateLabel' },
    ],
  }
}

export function buildMockBiDrillRows(req: BiDrillRequest): BiDrillRow[] {
  if (req.metric.startsWith('funnel:')) {
    return [
      { deal: 'Enterprise License', company: 'Acme', amount: '$35k', owner: 'Jane' },
      { deal: 'Platform Upgrade', company: 'Global Systems', amount: '$48k', owner: 'Mike' },
      { deal: 'Annual Support', company: 'TechStart', amount: '$12k', owner: 'John' },
    ]
  }
  if (req.metric === 'team') {
    return [
      { member: 'Sebastian Gray', deals: 42, revenue: '$1.2M', winRate: '34%' },
      { member: 'Emily Chen', deals: 38, revenue: '$980k', winRate: '31%' },
      { member: 'Marcus Johnson', deals: 35, revenue: '$870k', winRate: '29%' },
    ]
  }
  return [
    { deal: 'Enterprise License', company: 'Acme', amount: '$35k', date: '2026-03-01', owner: 'Jane' },
    { deal: 'Consulting Pack', company: 'Nova Labs', amount: '$22k', date: '2026-03-05', owner: 'Mike' },
    { deal: 'Annual Support', company: 'TechStart', amount: '$12k', date: '2026-03-08', owner: 'John' },
    { deal: 'Platform Upgrade', company: 'Global Systems', amount: '$48k', date: '2026-03-10', owner: 'Jane' },
  ]
}

export function buildMockBiReports(): BiReport[] {
  return [
    { id: 'sales-daily', categoryKey: 'reports.categories.sales', titleKey: 'reports.items.salesDaily.title', descKey: 'reports.items.salesDaily.desc', periodKey: 'reports.period.daily', format: 'table', updatedAt: new Date().toISOString() },
    { id: 'sales-weekly', categoryKey: 'reports.categories.sales', titleKey: 'reports.items.salesWeekly.title', descKey: 'reports.items.salesWeekly.desc', periodKey: 'reports.period.weekly', format: 'mixed', updatedAt: new Date().toISOString() },
    { id: 'funnel-monthly', categoryKey: 'reports.categories.sales', titleKey: 'reports.items.funnelMonthly.title', descKey: 'reports.items.funnelMonthly.desc', periodKey: 'reports.period.monthly', format: 'chart', updatedAt: new Date().toISOString() },
    { id: 'team-performance', categoryKey: 'reports.categories.team', titleKey: 'reports.items.teamPerformance.title', descKey: 'reports.items.teamPerformance.desc', periodKey: 'reports.period.monthly', format: 'table', updatedAt: new Date().toISOString() },
    { id: 'lead-source', categoryKey: 'reports.categories.marketing', titleKey: 'reports.items.leadSource.title', descKey: 'reports.items.leadSource.desc', periodKey: 'reports.period.monthly', format: 'chart', updatedAt: new Date().toISOString() },
    { id: 'ops-asset', categoryKey: 'reports.categories.ops', titleKey: 'reports.items.opsAsset.title', descKey: 'reports.items.opsAsset.desc', periodKey: 'reports.period.weekly', format: 'table', updatedAt: new Date().toISOString() },
  ]
}

export function buildMockBiReportPreview(reportId: string): BiReportPreview {
  const rowsByReport: Record<string, BiReportPreview> = {
    'sales-daily': {
      reportId,
      columns: ['date', 'deals', 'revenue', 'won'],
      rows: [
        { date: '2026-03-08', deals: 12, revenue: '$42k', won: 3 },
        { date: '2026-03-09', deals: 15, revenue: '$51k', won: 4 },
        { date: '2026-03-10', deals: 11, revenue: '$38k', won: 2 },
      ],
      summary: 'reports.preview.salesDailySummary',
    },
    'ops-asset': {
      reportId,
      columns: ['asset', 'env', 'count', 'alerts'],
      rows: [
        { asset: '项目', env: '生产', count: 12, alerts: 0 },
        { asset: '服务器', env: '生产', count: 18, alerts: 2 },
        { asset: '组件', env: '预发', count: 24, alerts: 1 },
      ],
      summary: 'reports.preview.opsSummary',
    },
  }

  return (
    rowsByReport[reportId] ?? {
      reportId,
      columns: ['metric', 'value', 'change'],
      rows: [
        { metric: '营收', value: '$350k', change: '+12.4%' },
        { metric: '商机', value: 467, change: '+8.1%' },
        { metric: '赢单率', value: '32.8%', change: '+1.2%' },
      ],
      summary: 'reports.preview.defaultSummary',
    }
  )
}
