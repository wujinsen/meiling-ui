import { getToken } from '@/utils/authSession'

/** markdown 插图鉴权上下文（T22 F1） */
export type KbAssetUrlContext = {
  spaceId: string
  documentSlug: string
  apiBase?: string
}

const KB_RAW_ASSET = /^(\/KnowledgeServer)?\/kb\/raw\/asset\?/i
const KB_WIKI_ASSET = /^(\/KnowledgeServer)?\/kb\/(?:wiki-moli\/|wiki\/)?asset\?/i

export function defaultKbApiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL ?? ''
  if (!env) return '/KnowledgeServer'
  return `${env.replace(/\/$/, '')}/KnowledgeServer`
}

/** markdown / HTML src 是否需走 kb asset 鉴权 fetch */
export function isKbAssetMarkdownSrc(src: string): boolean {
  const t = src.trim()
  if (!t || t.startsWith('data:')) return false
  if (KB_RAW_ASSET.test(t) || KB_WIKI_ASSET.test(t)) return true
  if (t.startsWith('assets/') || t.startsWith('./assets/')) return true
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      return KB_RAW_ASSET.test(u.pathname + u.search) || KB_WIKI_ASSET.test(u.pathname + u.search)
        || /\/kb\/(?:raw|wiki-moli|wiki)\/asset/i.test(u.pathname)
    } catch {
      return false
    }
  }
  return false
}

/**
 * 将 markdown img src 解析为完整 fetch URL；非 kb asset 返回 null。
 * @see docs/api/kb-markdown-image-frontend.md §4.2
 */
export function resolveKbAssetUrl(src: string, ctx: KbAssetUrlContext): string | null {
  const base = ctx.apiBase ?? defaultKbApiBase()
  const trimmed = src.trim()
  if (!trimmed) return null

  if (KB_RAW_ASSET.test(trimmed) || KB_WIKI_ASSET.test(trimmed)) {
    let pathAndQuery = trimmed.replace(/^\/KnowledgeServer/i, '')
    if (!pathAndQuery.startsWith('/')) pathAndQuery = `/${pathAndQuery}`
    return `${base}${pathAndQuery}`
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      if (/\/kb\/(?:raw|wiki-moli|wiki)\/asset/i.test(u.pathname)) {
        return u.toString()
      }
    } catch {
      /* ignore */
    }
    return null
  }

  if (trimmed.startsWith('assets/') || trimmed.startsWith('./assets/')) {
    const rel = trimmed.replace(/^\.\//, '')
    const slug = ctx.documentSlug?.trim()
    if (!slug) return null
    const q = new URLSearchParams({
      spaceId: ctx.spaceId,
      slug,
      rel,
    })
    return `${base}/kb/wiki/asset?${q.toString()}`
  }

  return null
}

/** 带 Authorization 拉取 asset，返回 blob object URL */
export async function fetchKbAssetBlob(resolvedUrl: string): Promise<string> {
  const token = getToken()
  const res = await fetch(resolvedUrl, {
    headers: token ? { Authorization: token } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`kb asset ${res.status}`)
  const contentType = res.headers.get('content-type') ?? ''
  // 后端业务错误也常以 HTTP 200 + application/json 返回（如 10006/10012），不能当图片 blob
  if (contentType.includes('application/json') || !contentType.startsWith('image/')) {
    throw new Error(`kb asset unexpected content-type: ${contentType || 'unknown'}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
