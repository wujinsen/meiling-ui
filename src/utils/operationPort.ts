/** 与后端 OperationPortMatchStatus 对齐 */
export const PORT_UNMAPPED = 0
export const PORT_MATCH = 1
export const PORT_MISMATCH = 2
export const PORT_SKIPPED = 3

export function portMatchLabelKey(status?: number | null): string {
  switch (status) {
    case PORT_MATCH:
      return 'operation.port.match'
    case PORT_MISMATCH:
      return 'operation.port.mismatch'
    case PORT_SKIPPED:
      return 'operation.port.skipped'
    default:
      return 'operation.port.unmapped'
  }
}

export function portMatchClass(status?: number | null): string {
  switch (status) {
    case PORT_MATCH:
      return 'text-emerald-600 dark:text-emerald-400'
    case PORT_MISMATCH:
      return 'text-red-600 dark:text-red-400'
    case PORT_SKIPPED:
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-gray-400'
  }
}

const DEPLOY_KEYS: Record<string, string> = {
  gateway: 'gateway',
  'moli-gateway': 'gateway',
  'user-center': 'user-center',
  'moli-user-center': 'user-center',
  'user-center-server': 'user-center',
  'moli-server': 'user-center',
  knowledge: 'knowledge',
  'moli-knowledge': 'knowledge',
  'knowledge-server': 'knowledge',
}

export function resolveDeployServiceKey(name?: string | null): string | null {
  if (!name) return null
  const key = name.trim().toLowerCase().replace(/_/g, '-')
  return DEPLOY_KEYS[key] ?? null
}
