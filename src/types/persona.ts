export type PersonaRange = '7d' | '30d' | '90d'

export type ChurnRisk = 'low' | 'medium' | 'high'

export type PersonaQuery = {
  range: PersonaRange
  segmentId: string
  risk: ChurnRisk | ''
  search: string
}

export type PersonaKpi = {
  key: string
  labelKey: string
  value: string
  change?: string
  up?: boolean
  subKey?: string
}

export type PersonaSegment = {
  id: string
  nameKey: string
  descKey: string
  count: number
  color: string
}

export type PersonaPieItem = {
  nameKey: string
  value: number
}

export type PersonaTrendPoint = {
  label: string
  active: number
  newUsers: number
}

export type PersonaUser = {
  id: string
  nickname: string
  avatar: string
  platform: 'ios' | 'android' | 'web'
  regionKey: string
  segmentIds: string[]
  tagKeys: string[]
  engagementScore: number
  churnRisk: ChurnRisk
  ltvTierKey: string
  lastActive: string
  sessions: number
  avgSessionMin: number
  registeredAt: string
}

export type PersonaTimelineEvent = {
  id: string
  time: string
  typeKey: string
  descKey: string
}

export type PersonaUserDetail = PersonaUser & {
  email: string
  device: string
  os: string
  timeline: PersonaTimelineEvent[]
  topEvents: { eventKey: string; count: number }[]
}

export type PersonaOverview = {
  refreshedAt: string
  kpis: PersonaKpi[]
  lifecycle: PersonaPieItem[]
  platforms: PersonaPieItem[]
  trend: PersonaTrendPoint[]
  segments: PersonaSegment[]
  users: PersonaUser[]
}
