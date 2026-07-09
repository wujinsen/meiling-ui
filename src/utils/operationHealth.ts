/** 与后端 OperationHealthStatus 对齐 */
export const HEALTH_UNKNOWN = 0
export const HEALTH_UP = 1
export const HEALTH_DOWN = 2
export const HEALTH_SKIPPED = 3

export function healthStatusLabelKey(status?: number | null): string {
  switch (status) {
    case HEALTH_UP:
      return 'operation.health.up'
    case HEALTH_DOWN:
      return 'operation.health.down'
    case HEALTH_SKIPPED:
      return 'operation.health.skipped'
    default:
      return 'operation.health.unknown'
  }
}

export function healthStatusClass(status?: number | null): string {
  switch (status) {
    case HEALTH_UP:
      return 'text-emerald-600 dark:text-emerald-400'
    case HEALTH_DOWN:
      return 'text-red-600 dark:text-red-400'
    case HEALTH_SKIPPED:
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-gray-400'
  }
}
