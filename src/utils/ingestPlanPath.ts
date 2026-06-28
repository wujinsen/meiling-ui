import type { KbCategoryTree, KbIngestPlanCreateItem } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

/** Plan create 行（含 UI 用的 categoryId 字符串） */
export type IngestPlanCreateRow = KbIngestPlanCreateItem & {
  categoryId?: string
}

const TYPE_DIRS: Record<string, string> = {
  guide: 'guides',
  service: 'services',
  concept: 'concepts',
  article: 'articles',
  interview: 'interview',
  output: 'outputs',
  exam: 'exams',
}

const WIKI_DIR_BY_SPACE: Record<string, string> = {
  'enterprise-kb': 'wiki',
  'moli-ops-manual': 'wiki-ops',
  'jp-fe-ap-exam': 'wiki-jp-exam',
}

export function wikiDirForSpace(spaceCode?: string): string {
  if (!spaceCode) return 'wiki'
  return WIKI_DIR_BY_SPACE[spaceCode] ?? `wiki-${spaceCode}`
}

/** Commit 落盘磁盘相对路径：{wikiDir}/{slug}.md */
export function wikiCommitPath(spaceCode: string | undefined, relSlug: string): string {
  const root = wikiDirForSpace(spaceCode)
  const s = relSlug.trim().replace(/\\/g, '/').replace(/\.md$/, '')
  return `${root}/${s}.md`
}

export function stemFromRawSource(sources?: string[]): string {
  const raw = sources?.[0] ?? ''
  const path = raw.replace(/^raw\//, '').trim()
  const name = path.split('/').pop() ?? path
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

export function buildCategoryIndex(tree: KbCategoryTree[]): Map<string, KbCategoryTree> {
  const map = new Map<string, KbCategoryTree>()
  const walk = (nodes: KbCategoryTree[]) => {
    for (const n of nodes) {
      const id = toEntityId(n.id)
      if (id) map.set(id, n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(tree)
  return map
}

function findCategoryByDirSlug(tree: KbCategoryTree[], dirSlug: string): KbCategoryTree | undefined {
  for (const n of tree) {
    if (n.dirSlug === dirSlug) return n
    if (n.children?.length) {
      const found = findCategoryByDirSlug(n.children, dirSlug)
      if (found) return found
    }
  }
  return undefined
}

/** raw/fe/foo.md → 匹配 dir_slug=fe 的分类 */
export function inferCategoryIdFromSources(sources: string[] | undefined, tree: KbCategoryTree[]): string {
  const raw = sources?.[0] ?? ''
  const path = raw.replace(/^raw\//, '').trim()
  const seg = path.split('/')[0]
  if (!seg || seg.includes('.')) return ''
  const cat = findCategoryByDirSlug(tree, seg)
  return toEntityId(cat?.id) ?? ''
}

export function previewRelPath(row: IngestPlanCreateRow, cat?: KbCategoryTree | null): string {
  const slug = (row.slug ?? '').trim()
  if (!slug) return ''
  const bare = slug.includes('/') ? slug.replace(/\.md$/, '') : slug.replace(/\.md$/, '')
  const categoryId = row.categoryId?.trim()
  if (categoryId && cat?.dirSlug) {
    if (slug.includes('/') || slug.includes('\\')) return ''
    return `${cat.dirSlug}/${bare}`
  }
  if (slug.includes('/') || slug.includes('\\')) {
    return bare.replace(/\\/g, '/')
  }
  const type = row.type || 'article'
  const dir = TYPE_DIRS[type] ?? 'articles'
  return `${dir}/${bare}`
}

export function parseCreateRowsFromPlan(create: unknown): IngestPlanCreateRow[] {
  if (!Array.isArray(create)) return []
  return create.map((item) => {
    const row = item as Record<string, unknown>
    const categoryId = row.categoryId != null && row.categoryId !== '' ? String(row.categoryId) : ''
    return {
      type: typeof row.type === 'string' ? row.type : 'article',
      slug: typeof row.slug === 'string' ? row.slug : '',
      title: typeof row.title === 'string' ? row.title : '',
      sources: Array.isArray(row.sources) ? row.sources.map(String) : [],
      reason: typeof row.reason === 'string' ? row.reason : '',
      categoryId,
    }
  })
}

export function createRowToPlanItem(row: IngestPlanCreateRow): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  if (row.categoryId?.trim()) item.categoryId = row.categoryId.trim()
  if (row.slug?.trim()) item.slug = row.slug.trim()
  if (row.title?.trim()) item.title = row.title.trim()
  if (row.sources?.length) item.sources = [...row.sources]
  if (row.type?.trim()) item.type = row.type.trim()
  if (row.reason?.trim()) item.reason = row.reason.trim()
  return item
}

export function applyCategoryInference(rows: IngestPlanCreateRow[], tree: KbCategoryTree[]): IngestPlanCreateRow[] {
  if (!tree.length) return rows
  return rows.map((row) => {
    if (row.categoryId?.trim()) return row
    const inferred = inferCategoryIdFromSources(row.sources, tree)
    if (!inferred) return row
    return { ...row, categoryId: inferred }
  })
}
