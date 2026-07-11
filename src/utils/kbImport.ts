import type { KbRawTreeNode } from '@/types/knowledge'

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

/** 从 raw-tree 根节点提取一级 prefix 建议（raw-prefixes API 不可用时的兜底） */
export function extractRawPrefixSuggestions(nodes: KbRawTreeNode[]): string[] {
  const set = new Set<string>()
  for (const n of nodes) {
    if (n.type !== 'dir') continue
    const path = n.path?.replace(/^\/+|\/+$/g, '').trim()
    if (path) set.add(path)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

const RAW_ZIP_MAX_BYTES = 50 * 1024 * 1024

export function validateRawUploadZip(file: File | null): 'empty' | 'badExt' | 'tooLarge' | null {
  if (!file) return 'empty'
  if (!file.name.toLowerCase().endsWith('.zip')) return 'badExt'
  if (file.size > RAW_ZIP_MAX_BYTES) return 'tooLarge'
  return null
}

const WIKI_BATCH_MAX_FILES = 20

export function validateWikiImportBatchFiles(files: File[]): string | null {
  if (!files.length) return 'empty'
  if (files.length > WIKI_BATCH_MAX_FILES) return 'tooMany'
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith('.md')) return 'badFileType'
  }
  return null
}
