import type { SystemVo } from '@/types/system'

export const SYSTEM_GROUP_ORDER = [
  'governance',
  'business',
  'ai',
  'tech',
  'ops',
  'data',
  'office',
] as const

export type SystemGroup = (typeof SYSTEM_GROUP_ORDER)[number]

export const DEFAULT_SYSTEM_GROUP: SystemGroup = 'business'

export function normalizeSystemGroup(group?: string | null): SystemGroup {
  if (group && (SYSTEM_GROUP_ORDER as readonly string[]).includes(group)) {
    return group as SystemGroup
  }
  return DEFAULT_SYSTEM_GROUP
}

export type PortalSystemGroup = {
  key: SystemGroup
  items: SystemVo[]
}

export type SystemGroupBucket<T> = {
  key: SystemGroup
  items: T[]
}

/** 分组标题左侧色条 / 图标底色（管理页卡片用） */
export const SYSTEM_GROUP_ACCENT: Record<SystemGroup, string> = {
  governance: 'from-violet-500 to-purple-600',
  business: 'from-brand-500 to-brand-600',
  ai: 'from-fuchsia-500 to-pink-600',
  tech: 'from-sky-500 to-cyan-600',
  ops: 'from-amber-500 to-orange-600',
  data: 'from-emerald-500 to-teal-600',
  office: 'from-rose-500 to-red-500',
}

export function groupSystemsByPortal<T extends { systemGroup?: string | null }>(
  systems: T[],
): SystemGroupBucket<T>[] {
  const map = new Map<SystemGroup, T[]>()
  for (const item of systems) {
    const key = normalizeSystemGroup(item.systemGroup)
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return SYSTEM_GROUP_ORDER.filter((key) => map.has(key)).map((key) => ({
    key,
    items: map.get(key)!,
  }))
}

export function countSystemsByGroup<T extends { systemGroup?: string | null }>(
  systems: T[],
): Record<SystemGroup, number> {
  const counts = Object.fromEntries(SYSTEM_GROUP_ORDER.map((key) => [key, 0])) as Record<SystemGroup, number>
  for (const item of systems) {
    counts[normalizeSystemGroup(item.systemGroup)] += 1
  }
  return counts
}

export function registryGroupDomId(key: SystemGroup) {
  return `registry-group-${key}`
}

export function filterPortalSystems(systems: SystemVo[], keyword?: string): SystemVo[] {
  const q = keyword?.trim().toLowerCase() ?? ''
  if (!q) return systems
  return systems.filter((item) => {
    const haystack = `${item.systemName ?? ''} ${item.systemCode ?? ''}`.toLowerCase()
    return haystack.includes(q)
  })
}

export function groupPortalSystems(systems: SystemVo[]): PortalSystemGroup[] {
  const map = new Map<SystemGroup, SystemVo[]>()
  for (const item of systems) {
    const key = normalizeSystemGroup(item.systemGroup)
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return SYSTEM_GROUP_ORDER.filter((key) => map.has(key)).map((key) => ({
    key,
    items: map.get(key)!,
  }))
}

export function portalGroupDomId(key: SystemGroup) {
  return `portal-group-${key}`
}
