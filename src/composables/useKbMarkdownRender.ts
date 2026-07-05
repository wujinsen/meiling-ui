import { createApp, nextTick, onUnmounted, watch, type App, type ComputedRef, type Ref } from 'vue'
import KbMarkdownImage from '@/components/knowledge/KbMarkdownImage.vue'
import { isKbAssetMarkdownSrc, resolveKbAssetUrl, type KbAssetUrlContext } from '@/utils/kbAssetUrl'

export type KbMarkdownRenderContext = {
  spaceId?: string | number
  documentSlug?: string
}

type MountRecord = { app: App; el: Element }

const mountRegistry = new WeakMap<HTMLElement, MountRecord[]>()

function resolveMarkdownRoot(container: HTMLElement | null | undefined): HTMLElement | null {
  if (!container) return null
  if (container.classList.contains('kb-markdown')) return container
  return container.querySelector<HTMLElement>('.kb-markdown')
}

function assetCtx(ctx: KbMarkdownRenderContext): KbAssetUrlContext {
  return {
    spaceId: ctx.spaceId != null && ctx.spaceId !== '' ? String(ctx.spaceId) : '',
    documentSlug: ctx.documentSlug ?? '',
  }
}

/** 剥离裸 kb asset src，改为 data-kb-asset-src 占位 */
function stripBareKbAssetSrc(root: HTMLElement) {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[src]')) {
    if (img.hasAttribute('data-kb-asset-src')) continue
    const src = img.getAttribute('src')?.trim()
    if (!src || !isKbAssetMarkdownSrc(src)) continue
    img.setAttribute('data-kb-asset-src', src)
    img.removeAttribute('src')
  }
}

export function unmountKbMarkdownImages(root: HTMLElement | null | undefined) {
  if (!root) return
  const records = mountRegistry.get(root)
  if (records) {
    for (const { app } of records) app.unmount()
    mountRegistry.delete(root)
  }
}

/** 将 markdown 容器内 kb asset 占位替换为 KbMarkdownImage 组件 */
export function mountKbMarkdownImages(
  root: HTMLElement | null | undefined,
  ctx: KbMarkdownRenderContext,
) {
  if (!root) return

  unmountKbMarkdownImages(root)
  stripBareKbAssetSrc(root)

  const urlCtx = assetCtx(ctx)
  const records: MountRecord[] = []

  const nodes = root.querySelectorAll<HTMLElement>('img[data-kb-asset-src]')
  for (const node of nodes) {
    const src = node.getAttribute('data-kb-asset-src') ?? ''
    if (!src || !resolveKbAssetUrl(src, urlCtx)) continue

    const alt = node.getAttribute('alt') ?? undefined
    const title = node.getAttribute('title') ?? undefined
    const mountPoint = document.createElement('span')
    mountPoint.className = 'kb-md-image-mount inline-block max-w-full'
    node.replaceWith(mountPoint)

    const app = createApp(KbMarkdownImage, {
      src,
      alt,
      title,
      spaceId: urlCtx.spaceId,
      documentSlug: urlCtx.documentSlug,
    })
    app.mount(mountPoint)
    records.push({ app, el: mountPoint })
  }

  if (records.length) mountRegistry.set(root, records)
}

export function unmountKbMarkdownInContainer(container: HTMLElement | null | undefined) {
  if (!container) return
  for (const root of container.querySelectorAll<HTMLElement>('.kb-markdown')) {
    unmountKbMarkdownImages(root)
  }
}

export function mountKbMarkdownInContainer(
  container: HTMLElement | null | undefined,
  ctx: KbMarkdownRenderContext,
) {
  if (!container) return
  for (const root of container.querySelectorAll<HTMLElement>('.kb-markdown')) {
    mountKbMarkdownImages(root, ctx)
  }
}

/**
 * v-html 渲染 markdown 后，挂载 KbMarkdownImage（browse / preview / wiki 预览）。
 */
export function useKbMarkdownRender(
  containerRef: Ref<HTMLElement | null | undefined>,
  ctx: Ref<KbMarkdownRenderContext> | ComputedRef<KbMarkdownRenderContext>,
  contentVersion: Ref<unknown> | ComputedRef<unknown>,
) {
  async function run() {
    await nextTick()
    const root = resolveMarkdownRoot(containerRef.value ?? undefined)
    unmountKbMarkdownImages(root ?? undefined)
    mountKbMarkdownImages(root ?? undefined, { ...ctx.value })
  }

  watch([contentVersion, ctx], () => void run(), { flush: 'post', deep: true })

  onUnmounted(() => {
    unmountKbMarkdownImages(resolveMarkdownRoot(containerRef.value ?? undefined) ?? undefined)
  })
}

/** 容器内多个 `.kb-markdown`（如智能问答多轮回答） */
export function useKbMarkdownRenderMulti(
  containerRef: Ref<HTMLElement | null | undefined>,
  ctx: Ref<KbMarkdownRenderContext> | ComputedRef<KbMarkdownRenderContext>,
  contentVersion: Ref<unknown> | ComputedRef<unknown>,
) {
  async function run() {
    await nextTick()
    unmountKbMarkdownInContainer(containerRef.value ?? undefined)
    mountKbMarkdownInContainer(containerRef.value ?? undefined, { ...ctx.value })
  }

  watch([contentVersion, ctx], () => void run(), { flush: 'post', deep: true })

  onUnmounted(() => {
    unmountKbMarkdownInContainer(containerRef.value ?? undefined)
  })
}
