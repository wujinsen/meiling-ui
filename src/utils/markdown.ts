/**
 * 极简 markdown 渲染（标题/列表/段落/行内 code/粗体 + 站内 [[slug]] 链接）。
 * 仅用于知识库正文展示；如需完整 markdown，可后续替换为 markdown-it。
 */

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内：转义 + code + 粗体 + 站内 [[slug]] / [[slug|文本]] 链接 */
function renderInline(text: string) {
  let html = escapeHtml(text)
  // 站内 wiki 链接：先于其它行内规则，避免被转义影响
  html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slug: string, label?: string) => {
    const s = slug.trim()
    const text = (label ?? slug).trim()
    return `<a data-slug="${escapeHtml(s)}" class="kb-wikilink">${escapeHtml(text)}</a>`
  })
  html = html.replace(/`([^`]+)`/g, '<code class="kb-code">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return html
}

export function renderMarkdown(content?: string): string {
  if (!content) return ''
  const lines = content.split('\n')
  const out: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      const size = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base'
      out.push(`<h${level} class="${size} font-semibold text-gray-900 dark:text-white mt-4 mb-2">${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) {
      if (!inList) {
        out.push('<ul class="my-2 list-disc space-y-1 pl-5 text-gray-600 dark:text-gray-300">')
        inList = true
      }
      out.push(`<li>${renderInline(li[1])}</li>`)
      continue
    }

    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (ol) {
      closeList()
      out.push(`<p class="ml-5 text-gray-600 dark:text-gray-300"><span class="mr-1 font-medium">${ol[1]}.</span>${renderInline(ol[2])}</p>`)
      continue
    }

    if (!line.trim()) {
      closeList()
      continue
    }

    closeList()
    out.push(`<p class="leading-relaxed text-gray-600 dark:text-gray-300">${renderInline(line)}</p>`)
  }

  closeList()
  return out.join('')
}
