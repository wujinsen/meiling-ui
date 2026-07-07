import { renderWikiPreviewMarkdown } from '@/utils/markdown'

export type WikiMarkdownPreviewRequest = {
  id: number
  content: string
}

export type WikiMarkdownPreviewResponse = {
  id: number
  html: string
}

self.onmessage = (event: MessageEvent<WikiMarkdownPreviewRequest>) => {
  const { id, content } = event.data
  const html = renderWikiPreviewMarkdown(content)
  const res: WikiMarkdownPreviewResponse = { id, html }
  self.postMessage(res)
}
