/** Wiki 新建页 frontmatter 模板与 slug 生成（对齐 kb/AGENTS.md §2） */

export const KB_WIKI_PAGE_TYPES = [
  'guide',
  'service',
  'concept',
  'article',
  'interview',
  'output',
] as const

export type KbWikiPageType = (typeof KB_WIKI_PAGE_TYPES)[number]

const WIKI_DRAFT_STORAGE_PREFIX = 'kb-wiki-draft:'

function yamlQuote(value: string): string {
  if (/[:#\n\r'"\\]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

/** 将标题转为 slug 路径段（不含 type 前缀） */
export function sanitizeWikiSlugSegment(title: string): string {
  const seg = title
    .trim()
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
  return seg || 'untitled'
}

/** 完整 wiki 路径 slug，如 guides/本地启动指南 */
export function buildWikiPathSlug(kbType: string, title: string, slugSegment?: string): string {
  const type = KB_WIKI_PAGE_TYPES.includes(kbType as KbWikiPageType) ? kbType : 'article'
  const seg = slugSegment?.trim() || sanitizeWikiSlugSegment(title)
  return `${type}/${seg}`
}

export function buildNewWikiMarkdown(title: string, pathSlug: string, kbType: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const shortSlug = pathSlug.includes('/') ? pathSlug.split('/').pop()! : pathSlug
  const safeTitle = title.trim()
  const safeType = KB_WIKI_PAGE_TYPES.includes(kbType as KbWikiPageType) ? kbType : 'article'
  return `---
title: ${yamlQuote(safeTitle)}
slug: ${shortSlug}
type: ${safeType}
status: draft
tags: []
sources:
  - Web 新建
related: []
created: ${today}
updated: ${today}
---

# ${safeTitle}

`
}

export function stashWikiDraft(spaceId: string, slug: string, content: string): void {
  sessionStorage.setItem(`${WIKI_DRAFT_STORAGE_PREFIX}${spaceId}:${slug}`, content)
}

export function popWikiDraft(spaceId: string, slug: string): string | null {
  const key = `${WIKI_DRAFT_STORAGE_PREFIX}${spaceId}:${slug}`
  const value = sessionStorage.getItem(key)
  if (value != null) sessionStorage.removeItem(key)
  return value
}
