export const MAX_SERVER_TAGS = 20
export const MAX_SERVER_TAG_LENGTH = 32

/** 与后端 OperationServerTagsSupport 一致：小写、数字、:-_ */
export function normalizeServerTag(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

export function isValidServerTag(tag: string) {
  return /^[a-z0-9][a-z0-9:_-]{0,31}$/.test(tag)
}

export function normalizeServerTags(tags?: string[] | null) {
  const deduped = new Set<string>()
  for (const raw of tags ?? []) {
    const tag = normalizeServerTag(raw)
    if (tag) deduped.add(tag)
  }
  return [...deduped]
}

export function serverTagBadgeClass(tag: string) {
  const palette = [
    'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    'bg-violet-50 text-violet-800 ring-violet-200/70 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
    'bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  ]
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash + tag.charCodeAt(i)) % palette.length
  return `ring-1 ring-inset ${palette[hash]}`
}
