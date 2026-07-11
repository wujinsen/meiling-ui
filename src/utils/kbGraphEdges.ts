import type { KbGraph, KbGraphLink, KbGraphMeta, KbGraphNode } from '@/types/knowledge'

/** edges.jsonl 单行（wiki graph/edges.jsonl） */
export type KbEdgesJsonlRecord = {
  from: string
  to: string
  type?: string
  evidence?: string
  date?: string
}

export function parseEdgesJsonl(text: string): KbEdgesJsonlRecord[] {
  const out: KbEdgesJsonlRecord[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed) as Partial<KbEdgesJsonlRecord>
      if (!row.from || !row.to) continue
      out.push({
        from: String(row.from),
        to: String(row.to),
        type: row.type ? String(row.type) : 'relates_to',
        evidence: row.evidence ? String(row.evidence) : undefined,
        date: row.date ? String(row.date) : undefined,
      })
    } catch {
      // 跳过坏行
    }
  }
  return out
}

function slugTail(slug: string): string {
  const s = slug.trim()
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

/** 将 edges.jsonl 记录合并进链接表（末段 slug 匹配，与 serve.py 一致） */
export function mergeEdgesJsonlIntoLinks(
  records: KbEdgesJsonlRecord[],
  knownSlugs: Set<string>,
  links: Map<string, KbGraphLink>,
): void {
  for (const e of records) {
    const from = slugTail(e.from)
    const to = slugTail(e.to)
    if (!knownSlugs.has(from) || !knownSlugs.has(to) || from === to) continue
    const key = `${from}->${to}`
    links.set(key, { source: from, target: to, type: e.type ?? 'relates_to' })
  }
}

export function degreeOf(nodes: KbGraphNode[], links: KbGraphLink[]): Map<string, number> {
  const deg = new Map<string, number>()
  for (const n of nodes) deg.set(n.id, 0)
  for (const l of links) {
    deg.set(l.source, (deg.get(l.source) ?? 0) + 1)
    deg.set(l.target, (deg.get(l.target) ?? 0) + 1)
  }
  return deg
}

/** 按度数裁剪子图（与后端 /kb/graph 行为对齐） */
export function cropGraphByDegree(
  nodes: KbGraphNode[],
  links: KbGraphLink[],
  opts: { maxNodes: number; minDeg: number; mode: 'full' | 'summary'; source: KbGraphMeta['source'] },
): KbGraph {
  const deg = degreeOf(nodes, links)
  nodes.forEach((n) => {
    n.deg = deg.get(n.id) ?? 0
  })

  let ranked = nodes.filter((n) => (n.deg ?? 0) >= opts.minDeg)
  ranked = [...ranked].sort((a, b) => (b.deg ?? 0) - (a.deg ?? 0))
  const truncated = ranked.length > opts.maxNodes
  const kept = truncated ? ranked.slice(0, opts.maxNodes) : ranked
  const keepIds = new Set(kept.map((n) => n.id))
  const keptLinks = links.filter((l) => keepIds.has(l.source) && keepIds.has(l.target))

  return {
    nodes: kept,
    links: keptLinks,
    meta: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      returnedNodes: kept.length,
      returnedLinks: keptLinks.length,
      truncated,
      source: opts.source,
      mode: opts.mode,
    },
  }
}
