import type { CockpitOverview, CockpitQuery, DrillRequest, DrillRow } from '@/types/cockpit'

const rangeScale: Record<CockpitQuery['range'], number> = {
  '7d': 0.35,
  '30d': 0.72,
  month: 1,
  quarter: 1.28,
}

export function buildMockCockpitOverview(query: CockpitQuery): CockpitOverview {
  const scale = rangeScale[query.range]
  const isOps = query.tab === 'ops'

  return {
    refreshedAt: new Date().toISOString(),
    kpis: isOps
      ? [
          { key: 'projects', label: 'cockpit.kpi.projects', value: String(Math.round(24 * scale)), change: '+3', up: true, drillMetric: 'ops:projects' },
          { key: 'servers', label: 'cockpit.kpi.servers', value: String(Math.round(18 * scale)), change: '+1', up: true, drillMetric: 'ops:servers' },
          { key: 'components', label: 'cockpit.kpi.components', value: String(Math.round(56 * scale)), change: '+6', up: true, drillMetric: 'ops:components' },
          { key: 'platforms', label: 'cockpit.kpi.platforms', value: String(Math.round(9 * scale)), sub: 'cockpit.kpi.platformsSub', drillMetric: 'ops:platforms' },
          { key: 'alerts', label: 'cockpit.kpi.alerts', value: String(Math.round(4 * scale)), change: '-2', up: false, drillMetric: 'ops:alerts' },
          { key: 'uptime', label: 'cockpit.kpi.uptime', value: '99.6%', change: '+0.2%', up: true },
        ]
      : [
          { key: 'revenue', label: 'cockpit.kpi.revenue', value: `$${Math.round(350 * scale)}k`, change: '+12.4%', up: true, drillMetric: 'revenue' },
          { key: 'deals', label: 'cockpit.kpi.deals', value: String(Math.round(467 * scale)), change: '+8.1%', up: true, drillMetric: 'deals' },
          { key: 'won', label: 'cockpit.kpi.won', value: String(Math.round(122 * scale)), change: '+5.2%', up: true, drillMetric: 'won' },
          { key: 'leads', label: 'cockpit.kpi.leads', value: String(Math.round(1847 * scale)), change: '+14%', up: true, drillMetric: 'leads' },
          { key: 'winRate', label: 'cockpit.kpi.winRate', value: '32.8%', change: '+1.2%', up: true, drillMetric: 'winRate' },
          { key: 'target', label: 'cockpit.kpi.target', value: '84.3%', sub: 'cockpit.kpi.targetSub', drillMetric: 'target' },
        ],
    revenueTrend: buildTrend(query),
    leadSources: [
      { name: 'cockpit.sources.referrals', value: 28, drillKey: 'referrals' },
      { name: 'cockpit.sources.organic', value: 24, drillKey: 'organic' },
      { name: 'cockpit.sources.social', value: 18, drillKey: 'social' },
      { name: 'cockpit.sources.paid', value: 14, drillKey: 'paid' },
      { name: 'cockpit.sources.direct', value: 10, drillKey: 'direct' },
      { name: 'cockpit.sources.other', value: 6, drillKey: 'other' },
    ],
    funnel: [
      { key: 'leads', stage: 'cockpit.funnel.leads', desc: 'cockpit.funnel.leadsDesc', count: Math.round(1847 * scale), rate: '100%', icon: 'users' },
      { key: 'qualified', stage: 'cockpit.funnel.qualified', desc: 'cockpit.funnel.qualifiedDesc', count: Math.round(924 * scale), rate: '50%', icon: 'filter' },
      { key: 'proposal', stage: 'cockpit.funnel.proposal', desc: 'cockpit.funnel.proposalDesc', count: Math.round(462 * scale), rate: '25%', icon: 'file' },
      { key: 'negotiation', stage: 'cockpit.funnel.negotiation', desc: 'cockpit.funnel.negotiationDesc', count: Math.round(231 * scale), rate: '12.5%', icon: 'handshake' },
      { key: 'won', stage: 'cockpit.funnel.won', desc: 'cockpit.funnel.wonDesc', count: Math.round(116 * scale), rate: '6.3%', icon: 'trophy' },
    ],
    ops: {
      projects: Math.round(24 * scale),
      servers: Math.round(18 * scale),
      platforms: Math.round(9 * scale),
      components: Math.round(56 * scale),
      envBreakdown: [
        { env: 1, count: 12 },
        { env: 2, count: 18 },
        { env: 3, count: 9 },
        { env: 4, count: 68 },
      ],
    },
    alerts: [
      { id: '1', level: 'warn', text: 'cockpit.alerts.item1', time: '2m' },
      { id: '2', level: 'error', text: 'cockpit.alerts.item2', time: '8m' },
      { id: '3', level: 'info', text: 'cockpit.alerts.item3', time: '15m' },
      { id: '4', level: 'warn', text: 'cockpit.alerts.item4', time: '22m' },
    ],
    topDeals: [
      { company: 'Stripe', value: '$70.0M', owner: 'John', stage: 'Proposal', prob: '92%' },
      { company: 'Acme Corp', value: '$35.0M', owner: 'Jane', stage: 'Negotiation', prob: '78%' },
      { company: 'Global Systems', value: '$28.5M', owner: 'Mike', stage: 'Qualified', prob: '65%' },
    ],
  }
}

function buildTrend(query: CockpitQuery) {
  const labels =
    query.granularity === 'day'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : query.granularity === 'week'
        ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

  const base = rangeScale[query.range]
  return labels.map((label, i) => ({
    label,
    actual: Math.round((80 + i * 22) * base),
    target: Math.round((75 + i * 18) * base),
  }))
}

export function buildMockDrillRows(req: DrillRequest): DrillRow[] {
  const metric = req.metric
  if (metric.startsWith('ops:env:')) {
    const envCode = metric.split(':')[2]
    const envNames: Record<string, string> = { '1': '开发', '2': '测试', '3': '预发', '4': '生产' }
    const envLabel = envNames[envCode] ?? envCode
    return [
      { name: 'api-gateway', env: envLabel, ip: '10.0.1.12', status: '正常' },
      { name: 'user-service', env: envLabel, ip: '10.0.1.18', status: '正常' },
      { name: 'mysql-primary', env: envLabel, ip: '10.0.3.2', status: '正常' },
    ]
  }
  if (metric.startsWith('ops:')) {
    return [
      { name: 'api-gateway', env: '生产', ip: '10.0.1.12', status: '正常' },
      { name: 'user-service', env: '生产', ip: '10.0.1.18', status: '正常' },
      { name: 'redis-cluster', env: '预发', ip: '10.0.2.5', status: '告警' },
      { name: 'mysql-primary', env: '测试', ip: '10.0.3.2', status: '正常' },
    ]
  }
  if (metric.startsWith('funnel:')) {
    return [
      { deal: 'Enterprise License', company: 'Acme', amount: '$35k', owner: 'Jane' },
      { deal: 'Platform Upgrade', company: 'Global Systems', amount: '$48k', owner: 'Mike' },
      { deal: 'Annual Support', company: 'TechStart', amount: '$12k', owner: 'John' },
    ]
  }
  return [
    { deal: 'Enterprise License', company: 'Acme', amount: '$35k', date: '2026-03-01', owner: 'Jane' },
    { deal: 'Consulting Pack', company: 'Nova Labs', amount: '$22k', date: '2026-03-05', owner: 'Mike' },
    { deal: 'Annual Support', company: 'TechStart', amount: '$12k', date: '2026-03-08', owner: 'John' },
    { deal: 'Platform Upgrade', company: 'Global Systems', amount: '$48k', date: '2026-03-10', owner: 'Jane' },
  ]
}
