/** T20 Tab1/Tab3 直联：表单预校验与错误文案识别 */

export function validateRawUploadPrefix(prefix: string): 'empty' | 'badPrefix' | null {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '')
  if (!trimmed) return 'empty'
  if (trimmed.includes('..') || /[\\<>|]/.test(trimmed)) return 'badPrefix'
  return null
}

export function isWikiImportConflictMessage(msg?: string | null): boolean {
  if (!msg) return false
  return /已存在|already exists|exists:/i.test(msg)
}

export function collectRawHighlightPaths(result: {
  uploaded?: { path: string }[]
  renamed?: { path: string }[]
}): string[] {
  const paths = [
    ...(result.uploaded ?? []).map((u) => u.path),
    ...(result.renamed ?? []).map((r) => r.path),
  ]
  return [...new Set(paths.filter(Boolean))]
}
