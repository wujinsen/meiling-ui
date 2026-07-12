/** edges.jsonl + kb_relation 关系类型配色（对齐 serve.py / Obsidian 图谱） */

export const KB_RELATION_COLORS: Record<string, string> = {
  links_to: '#60a5fa',
  deploys: '#60a5fa',
  relates_to: '#34d399',
  related: '#34d399',
  same_tag: '#fbbf24',
  depends_on: '#a78bfa',
  part_of: '#f472b6',
  derived_from: '#22d3ee',
  supersedes: '#fb923c',
  ref: '#22d3ee',
  contradiction: '#f87171',
  inference: '#c084fc',
}

/** edges.jsonl 显式边类型（Ingest / Enrich 写入） */
export const KB_EDGES_JSONL_TYPES = [
  'depends_on',
  'relates_to',
  'part_of',
  'derived_from',
  'supersedes',
] as const

export type KbEdgesJsonlType = (typeof KB_EDGES_JSONL_TYPES)[number]

/** 虚线边：推断 / 矛盾 / 被取代 */
export const KB_DASHED_RELATIONS = new Set(['contradiction', 'inference', 'supersedes'])

export function relationColor(type: string | undefined, dark: boolean): string {
  if (!type) return dark ? '#3f4252' : '#cbd5e1'
  return KB_RELATION_COLORS[type] ?? (dark ? '#6b7280' : '#94a3b8')
}

export function isEdgesJsonlType(type: string | undefined): boolean {
  return !!type && (KB_EDGES_JSONL_TYPES as readonly string[]).includes(type)
}
