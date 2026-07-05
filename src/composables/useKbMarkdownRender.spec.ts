import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mountKbMarkdownImages,
  mountKbMarkdownInContainer,
  unmountKbMarkdownImages,
} from '@/composables/useKbMarkdownRender'

vi.mock('@/utils/kbAssetUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/kbAssetUrl')>()
  return {
    ...actual,
    fetchKbAssetBlob: vi.fn(async () => 'blob:mock-image'),
  }
})

describe('mountKbMarkdownImages', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    root.className = 'kb-markdown'
    document.body.appendChild(root)
  })

  afterEach(() => {
    unmountKbMarkdownImages(root)
    root.remove()
  })

  it('strips bare kb raw src and mounts KbMarkdownImage', async () => {
    root.innerHTML =
      '<p><img alt="diagram" src="/KnowledgeServer/kb/raw/asset?spaceId=1&amp;path=a.png" /></p>'

    mountKbMarkdownImages(root, {
      spaceId: '900000000000000001',
      documentSlug: 'bigdata/hadoop-生态入门',
    })

    expect(root.querySelector('img[src*="kb/raw/asset"]')).toBeNull()
    expect(root.querySelector('.kb-md-image-mount')).not.toBeNull()

    await vi.waitFor(() => {
      expect(root.querySelector('img.kb-md-img-loaded')).not.toBeNull()
    })
  })

  it('mounts data-kb-asset-src placeholders', async () => {
    root.innerHTML =
      '<img data-kb-asset-src="/KnowledgeServer/kb/raw/asset?spaceId=1&path=b.png" alt="b" />'

    mountKbMarkdownImages(root, { spaceId: '1', documentSlug: 'java/jvm' })

    await vi.waitFor(() => {
      expect(root.querySelector('img.kb-md-img-loaded')).not.toBeNull()
    })
  })

  it('unmount removes mounted components', async () => {
    root.innerHTML =
      '<img data-kb-asset-src="/KnowledgeServer/kb/raw/asset?spaceId=1&path=c.png" alt="c" />'
    mountKbMarkdownImages(root, { spaceId: '1', documentSlug: 'java/jvm' })
    await vi.waitFor(() => expect(root.querySelector('.kb-md-image-mount')).not.toBeNull())

    unmountKbMarkdownImages(root)
    expect(root.querySelector('img.kb-md-img-loaded')).toBeNull()
    expect(root.querySelector('.kb-md-image-mount')?.textContent?.trim()).toBe('')
  })
})

describe('mountKbMarkdownInContainer', () => {
  it('finds nested .kb-markdown blocks', async () => {
    const container = document.createElement('div')
    container.innerHTML =
      '<div class="kb-markdown"><img data-kb-asset-src="/KnowledgeServer/kb/raw/asset?spaceId=1&path=d.png" /></div>'
    document.body.appendChild(container)

    mountKbMarkdownInContainer(container, { spaceId: '1', documentSlug: 'java/jvm' })

    await vi.waitFor(() => {
      expect(container.querySelector('img.kb-md-img-loaded')).not.toBeNull()
    })

    container.remove()
  })
})
