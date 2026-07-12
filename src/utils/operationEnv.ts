import type { Environment } from '@/types/operation'

export const ENVIRONMENT_OPTIONS: Environment[] = [1, 2, 3, 4]

/** 驾驶舱 envBreakdown 饼图色（dev / test / pre / pro） */
export const ENVIRONMENT_CHART_COLORS: Record<Environment, string> = {
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#8b5cf6',
  4: '#10b981',
}

export type EnvBreakdownItem = { env: number; count: number }

/** 补齐 1–4 环境，缺失项 count=0，便于饼图稳定展示 */
export function normalizeEnvBreakdown(items?: EnvBreakdownItem[]): EnvBreakdownItem[] {
  const byEnv = new Map<number, number>()
  for (const item of items ?? []) {
    if (item.env >= 1 && item.env <= 4) byEnv.set(item.env, Number(item.count) || 0)
  }
  return ENVIRONMENT_OPTIONS.map((env) => ({ env, count: byEnv.get(env) ?? 0 }))
}

export function environmentChartColor(env?: number) {
  if (env === 1 || env === 2 || env === 3 || env === 4) return ENVIRONMENT_CHART_COLORS[env]
  return '#6b7280'
}

export function environmentI18nKey(env?: number) {
  if (env === 1) return 'operation.env.dev'
  if (env === 2) return 'operation.env.test'
  if (env === 3) return 'operation.env.pre'
  if (env === 4) return 'operation.env.pro'
  return 'operation.env.unknown'
}

/** 列表环境标签（对齐 operation-task-status 扁平样式） */
export function environmentBadgeClass(env?: number): string {
  switch (env) {
    case 1:
      return 'operation-env-badge--dev'
    case 2:
      return 'operation-env-badge--test'
    case 3:
      return 'operation-env-badge--pre'
    case 4:
      return 'operation-env-badge--pro'
    default:
      return 'operation-env-badge--unknown'
  }
}
