import type { Environment } from '@/types/operation'

export const ENVIRONMENT_OPTIONS: Environment[] = [1, 2, 3, 4]

export function environmentI18nKey(env?: number) {
  if (env === 1) return 'operation.env.dev'
  if (env === 2) return 'operation.env.test'
  if (env === 3) return 'operation.env.pre'
  if (env === 4) return 'operation.env.pro'
  return 'operation.env.unknown'
}
