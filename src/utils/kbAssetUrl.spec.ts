import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchKbAssetBlob,
  isKbAssetMarkdownSrc,
  resolveKbAssetUrl,
  type KbAssetUrlContext,
} from '@/utils/kbAssetUrl'

const ctx: KbAssetUrlContext = {
  spaceId: '900000000000000001',
  documentSlug: 'bigdata/hadoop-生态入门',
  apiBase: '/KnowledgeServer',
}

describe('isKbAssetMarkdownSrc', () => {
  it('accepts kb raw asset paths', () => {
    expect(
      isKbAssetMarkdownSrc('/KnowledgeServer/kb/raw/asset?spaceId=1&path=a.png'),
    ).toBe(true)
  })

  it('accepts wiki asset paths', () => {
    expect(isKbAssetMarkdownSrc('/kb/wiki/asset?spaceId=1&slug=java/jvm&rel=assets/a.png')).toBe(
      true,
    )
  })

  it('accepts relative assets/', () => {
    expect(isKbAssetMarkdownSrc('assets/imageFile1.png')).toBe(true)
  })

  it('rejects data urls and plain external images', () => {
    expect(isKbAssetMarkdownSrc('data:image/png;base64,abc')).toBe(false)
    expect(isKbAssetMarkdownSrc('https://cdn.example.com/a.png')).toBe(false)
  })
})

describe('resolveKbAssetUrl', () => {
  it('prefixes KnowledgeServer raw asset', () => {
    const url = resolveKbAssetUrl(
      '/KnowledgeServer/kb/raw/asset?spaceId=900000000000000001&path=wujinsen_markdown/a.png',
      ctx,
    )
    expect(url).toBe(
      '/KnowledgeServer/kb/raw/asset?spaceId=900000000000000001&path=wujinsen_markdown/a.png',
    )
  })

  it('builds wiki asset url from assets/ rel', () => {
    const url = resolveKbAssetUrl('assets/gc.png', ctx)
    expect(url).toContain('/KnowledgeServer/kb/wiki/asset?')
    expect(url).toContain('slug=bigdata%2Fhadoop-%E7%94%9F%E6%80%81%E5%85%A5%E9%97%A8')
    expect(url).toContain('rel=assets%2Fgc.png')
  })

  it('returns null for assets/ without documentSlug', () => {
    expect(resolveKbAssetUrl('assets/gc.png', { spaceId: ctx.spaceId, documentSlug: '' })).toBeNull()
  })
})

describe('fetchKbAssetBlob', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      ),
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-png')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects application/json even when ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('{"code":10006}', {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
      }),
    )

    await expect(fetchKbAssetBlob('/KnowledgeServer/kb/raw/asset?x=1')).rejects.toThrow(
      /unexpected content-type/i,
    )
  })

  it('returns blob url for image/png', async () => {
    const url = await fetchKbAssetBlob('/KnowledgeServer/kb/raw/asset?x=1')
    expect(url).toBe('blob:mock-png')
    expect(fetch).toHaveBeenCalledWith(
      '/KnowledgeServer/kb/raw/asset?x=1',
      expect.objectContaining({
        headers: { Authorization: 'login_token_test' },
      }),
    )
  })
})
