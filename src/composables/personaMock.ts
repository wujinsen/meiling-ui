import type {
  ChurnRisk,
  PersonaOverview,
  PersonaQuery,
  PersonaUser,
  PersonaUserDetail,
} from '@/types/persona'

const rangeScale: Record<PersonaQuery['range'], number> = {
  '7d': 0.42,
  '30d': 1,
  '90d': 1.35,
}

const allUsers: PersonaUser[] = [
  {
    id: 'u-1001',
    nickname: 'Alex Chen',
    avatar: 'AC',
    platform: 'ios',
    regionKey: 'persona.regions.cnEast',
    segmentIds: ['power', 'paid'],
    tagKeys: ['persona.tags.frequent', 'persona.tags.highValue'],
    engagementScore: 92,
    churnRisk: 'low',
    ltvTierKey: 'persona.ltv.high',
    lastActive: '2h ago',
    sessions: 48,
    avgSessionMin: 18.2,
    registeredAt: '2025-08-12',
  },
  {
    id: 'u-1002',
    nickname: 'Mia Park',
    avatar: 'MP',
    platform: 'android',
    regionKey: 'persona.regions.cnSouth',
    segmentIds: ['new'],
    tagKeys: ['persona.tags.onboarding', 'persona.tags.mobile'],
    engagementScore: 61,
    churnRisk: 'medium',
    ltvTierKey: 'persona.ltv.mid',
    lastActive: '1d ago',
    sessions: 12,
    avgSessionMin: 9.4,
    registeredAt: '2026-02-28',
  },
  {
    id: 'u-1003',
    nickname: 'Jordan Lee',
    avatar: 'JL',
    platform: 'web',
    regionKey: 'persona.regions.apac',
    segmentIds: ['churn-risk'],
    tagKeys: ['persona.tags.dormant', 'persona.tags.support'],
    engagementScore: 28,
    churnRisk: 'high',
    ltvTierKey: 'persona.ltv.low',
    lastActive: '14d ago',
    sessions: 3,
    avgSessionMin: 4.1,
    registeredAt: '2024-11-03',
  },
  {
    id: 'u-1004',
    nickname: 'Sam Rivera',
    avatar: 'SR',
    platform: 'ios',
    regionKey: 'persona.regions.na',
    segmentIds: ['power'],
    tagKeys: ['persona.tags.frequent', 'persona.tags.referral'],
    engagementScore: 88,
    churnRisk: 'low',
    ltvTierKey: 'persona.ltv.high',
    lastActive: '30m ago',
    sessions: 36,
    avgSessionMin: 22.5,
    registeredAt: '2025-03-19',
  },
  {
    id: 'u-1005',
    nickname: 'Priya Nair',
    avatar: 'PN',
    platform: 'android',
    regionKey: 'persona.regions.in',
    segmentIds: ['paid', 'new'],
    tagKeys: ['persona.tags.trial', 'persona.tags.mobile'],
    engagementScore: 54,
    churnRisk: 'medium',
    ltvTierKey: 'persona.ltv.mid',
    lastActive: '3d ago',
    sessions: 9,
    avgSessionMin: 11.0,
    registeredAt: '2026-01-15',
  },
  {
    id: 'u-1006',
    nickname: 'Chris Wu',
    avatar: 'CW',
    platform: 'web',
    regionKey: 'persona.regions.cnEast',
    segmentIds: ['churn-risk'],
    tagKeys: ['persona.tags.dormant'],
    engagementScore: 19,
    churnRisk: 'high',
    ltvTierKey: 'persona.ltv.low',
    lastActive: '21d ago',
    sessions: 2,
    avgSessionMin: 3.2,
    registeredAt: '2024-06-22',
  },
  {
    id: 'u-1007',
    nickname: 'Emma Fox',
    avatar: 'EF',
    platform: 'ios',
    regionKey: 'persona.regions.eu',
    segmentIds: ['power', 'paid'],
    tagKeys: ['persona.tags.highValue', 'persona.tags.frequent'],
    engagementScore: 95,
    churnRisk: 'low',
    ltvTierKey: 'persona.ltv.high',
    lastActive: '15m ago',
    sessions: 52,
    avgSessionMin: 24.8,
    registeredAt: '2024-09-08',
  },
  {
    id: 'u-1008',
    nickname: 'Noah Kim',
    avatar: 'NK',
    platform: 'android',
    regionKey: 'persona.regions.cnNorth',
    segmentIds: ['new'],
    tagKeys: ['persona.tags.onboarding'],
    engagementScore: 47,
    churnRisk: 'medium',
    ltvTierKey: 'persona.ltv.mid',
    lastActive: '5h ago',
    sessions: 7,
    avgSessionMin: 8.6,
    registeredAt: '2026-03-01',
  },
]

function filterUsers(query: PersonaQuery): PersonaUser[] {
  let list = [...allUsers]
  if (query.segmentId) {
    list = list.filter((u) => u.segmentIds.includes(query.segmentId))
  }
  if (query.risk) {
    list = list.filter((u) => u.churnRisk === query.risk)
  }
  if (query.search.trim()) {
    const q = query.search.trim().toLowerCase()
    list = list.filter((u) => u.nickname.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
  }
  return list
}

export function buildMockPersonaOverview(query: PersonaQuery): PersonaOverview {
  const scale = rangeScale[query.range]
  const users = filterUsers(query)

  return {
    refreshedAt: new Date().toISOString(),
    kpis: [
      { key: 'mau', labelKey: 'persona.kpi.mau', value: Math.round(48291 * scale).toLocaleString(), change: '+8.1%', up: true, subKey: 'persona.kpi.mauSub' },
      { key: 'dau', labelKey: 'persona.kpi.dau', value: Math.round(12840 * scale).toLocaleString(), change: '+5.4%', up: true },
      { key: 'churnRisk', labelKey: 'persona.kpi.churnRisk', value: String(Math.round(1240 * scale)), change: '-3.2%', up: false, subKey: 'persona.kpi.churnRiskSub' },
      { key: 'highValue', labelKey: 'persona.kpi.highValue', value: String(Math.round(3860 * scale)), change: '+12%', up: true, subKey: 'persona.kpi.highValueSub' },
    ],
    lifecycle: [
      { nameKey: 'persona.lifecycle.new', value: 18 },
      { nameKey: 'persona.lifecycle.active', value: 52 },
      { nameKey: 'persona.lifecycle.dormant', value: 22 },
      { nameKey: 'persona.lifecycle.churned', value: 8 },
    ],
    platforms: [
      { nameKey: 'persona.platform.ios', value: 38 },
      { nameKey: 'persona.platform.android', value: 34 },
      { nameKey: 'persona.platform.web', value: 28 },
    ],
    trend:
      query.range === '7d'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
            label,
            active: Math.round((11000 + i * 420) * scale),
            newUsers: Math.round((320 + i * 28) * scale),
          }))
        : query.range === '90d'
          ? ['M1', 'M2', 'M3'].map((label, i) => ({
              label,
              active: Math.round((42000 + i * 2800) * scale),
              newUsers: Math.round((2800 + i * 320) * scale),
            }))
          : ['W1', 'W2', 'W3', 'W4'].map((label, i) => ({
              label,
              active: Math.round((11500 + i * 680) * scale),
              newUsers: Math.round((340 + i * 45) * scale),
            })),
    segments: [
      { id: 'power', nameKey: 'persona.segments.power.name', descKey: 'persona.segments.power.desc', count: Math.round(3860 * scale), color: '#8b5cf6' },
      { id: 'new', nameKey: 'persona.segments.new.name', descKey: 'persona.segments.new.desc', count: Math.round(8920 * scale), color: '#3b82f6' },
      { id: 'churn-risk', nameKey: 'persona.segments.churnRisk.name', descKey: 'persona.segments.churnRisk.desc', count: Math.round(1240 * scale), color: '#f59e0b' },
      { id: 'paid', nameKey: 'persona.segments.paid.name', descKey: 'persona.segments.paid.desc', count: Math.round(5620 * scale), color: '#10b981' },
    ],
    users,
  }
}

export function buildMockPersonaUserDetail(userId: string): PersonaUserDetail | null {
  const user = allUsers.find((u) => u.id === userId)
  if (!user) return null

  return {
    ...user,
    email: `${user.nickname.toLowerCase().replace(/\s/g, '.')}@example.com`,
    device: user.platform === 'ios' ? 'iPhone 15 Pro' : user.platform === 'android' ? 'Pixel 8' : 'Chrome / Win11',
    os: user.platform === 'web' ? 'Web' : user.platform === 'ios' ? 'iOS 18' : 'Android 14',
    timeline: [
      { id: '1', time: '2h ago', typeKey: 'persona.event.session', descKey: 'persona.event.sessionDesc' },
      { id: '2', time: '1d ago', typeKey: 'persona.event.feature', descKey: 'persona.event.featureDesc' },
      { id: '3', time: '3d ago', typeKey: 'persona.event.purchase', descKey: 'persona.event.purchaseDesc' },
      { id: '4', time: '1w ago', typeKey: 'persona.event.support', descKey: 'persona.event.supportDesc' },
    ],
    topEvents: [
      { eventKey: 'persona.events.viewDashboard', count: 42 },
      { eventKey: 'persona.events.export', count: 18 },
      { eventKey: 'persona.events.share', count: 9 },
    ],
  }
}

export function riskClass(risk: ChurnRisk) {
  return {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    high: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  }[risk]
}
