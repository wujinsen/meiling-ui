export const SERVER_ROLE_OPTIONS = [
  'app',
  'db',
  'cache',
  'mq',
  'gateway',
  'bastion',
  'middleware',
  'other',
] as const

export type ServerRole = (typeof SERVER_ROLE_OPTIONS)[number]

export function serverRoleI18nKey(role?: string | null) {
  if (role && SERVER_ROLE_OPTIONS.includes(role as ServerRole)) {
    return `operation.serverRole.${role}`
  }
  return 'operation.serverRole.unknown'
}

export function serverRoleBadgeClass(role?: string | null): string {
  switch (role) {
    case 'app':
      return 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30'
    case 'db':
      return 'bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30'
    case 'cache':
      return 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
    case 'mq':
      return 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200/70 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30'
    case 'gateway':
      return 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200/70 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30'
    case 'bastion':
      return 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
    case 'middleware':
      return 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200/70 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30'
    case 'other':
      return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:bg-white/10 dark:text-gray-400 dark:ring-white/10'
    default:
      return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:bg-white/10 dark:text-gray-400 dark:ring-white/10'
  }
}
