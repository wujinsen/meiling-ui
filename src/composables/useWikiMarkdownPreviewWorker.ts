import { onUnmounted } from 'vue'
import { renderWikiPreviewMarkdown } from '@/utils/markdown'
import type { WikiMarkdownPreviewRequest, WikiMarkdownPreviewResponse } from '@/workers/wikiMarkdownPreview.worker'

export function useWikiMarkdownPreviewWorker() {
  let worker: Worker | null = null
  let latestId = 0

  function getWorker(): Worker | null {
    if (typeof Worker === 'undefined') return null
    if (!worker) {
      worker = new Worker(new URL('../workers/wikiMarkdownPreview.worker.ts', import.meta.url), {
        type: 'module',
      })
    }
    return worker
  }

  function renderPreview(content: string): Promise<string> {
    const w = getWorker()
    if (!w) return Promise.resolve(renderWikiPreviewMarkdown(content))

    const id = ++latestId
    return new Promise((resolve) => {
      const onMessage = (event: MessageEvent<WikiMarkdownPreviewResponse>) => {
        if (event.data.id !== id) return
        w.removeEventListener('message', onMessage)
        resolve(event.data.html)
      }
      w.addEventListener('message', onMessage)
      const req: WikiMarkdownPreviewRequest = { id, content }
      w.postMessage(req)
    })
  }

  function dispose() {
    worker?.terminate()
    worker = null
  }

  onUnmounted(dispose)

  return { renderPreview, dispose }
}
