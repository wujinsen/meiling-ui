/**
 * 极简 markdown 渲染（标题/列表/表格/段落/行内 code/粗体 + 站内 [[slug]] 链接）。
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
    return `<a href="#" data-slug="${escapeHtml(s)}" class="kb-wikilink">${escapeHtml(text)}</a>`
  })
  html = html.replace(/`([^`]+)`/g, '<code class="kb-code">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, href: string) => {
    const safeAlt = escapeHtml(alt)
    const safeHref = escapeHtml(href.trim())
    return `<img class="kb-md-img kb-md-img-pending" alt="${safeAlt}" data-kb-asset-src="${safeHref}" loading="lazy" decoding="async" />`
  })
  return html
}

function isTableRow(line: string) {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.length > 2
}

function isTableSeparator(line: string) {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

function parseTableCells(line: string) {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim())
}

function renderTable(header: string[], rows: string[][]) {
  const ths = header.map((c) => `<th>${renderInline(c)}</th>`).join('')
  const trs = rows
    .map((row) => `<tr>${row.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="kb-table-wrap"><table class="kb-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
}

const markdownCache = new Map<string, string>()
const MARKDOWN_CACHE_MAX = 48
const MARKDOWN_CACHE_VERSION = 'v6'

/** Ingest / raw 来源 wiki 常含内嵌 HTML 表格，预览需原样渲染（仅去掉明显 XSS） */
const HTML_BLOCK_TAGS = ['table', 'div', 'figure', 'section', 'article', 'details'] as const

function sanitizeWikiHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

function tagDepthDelta(line: string, tag: string): number {
  const open = (line.match(new RegExp(`<${tag}(\\s|>|/)`, 'gi')) ?? []).length
  const close = (line.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
  return open - close
}

function tryConsumeHtmlBlock(lines: string[], start: number): { html: string; next: number } | null {
  const line = lines[start] ?? ''
  const open = line.match(new RegExp(`^\\s*<(${HTML_BLOCK_TAGS.join('|')})\\b`, 'i'))
  if (!open) return null
  const tag = open[1]!.toLowerCase()
  let depth = 0
  const buf: string[] = []
  for (let i = start; i < lines.length; i += 1) {
    const cur = lines[i]!
    buf.push(cur)
    depth += tagDepthDelta(cur, tag)
    if (depth <= 0 && i > start) {
      return { html: buf.join('\n'), next: i + 1 }
    }
  }
  if (buf.length) return { html: buf.join('\n'), next: lines.length }
  return null
}

function wrapHtmlBlock(html: string): string {
  return `<div class="kb-html-block">${sanitizeWikiHtml(html.trim())}</div>`
}

/** 去掉 wiki 文件 leading YAML frontmatter（编辑区存全文，预览只渲染正文） */
export function stripYamlFrontmatter(content: string): string {
  const text = content.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return content
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return content
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === '---') {
      return lines.slice(i + 1).join('\n')
    }
  }
  return content
}

/** Wiki 编辑「预览」：与浏览页一致，不展示 frontmatter 块 */
export function renderWikiPreviewMarkdown(content?: string): string {
  return renderMarkdown(stripYamlFrontmatter(content ?? ''))
}

function markdownCacheKey(content: string) {
  return `${MARKDOWN_CACHE_VERSION}::${content}`
}

function renderMarkdownBody(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []
  let inList = false
  let i = 0

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    const htmlBlock = tryConsumeHtmlBlock(lines, i)
    if (htmlBlock) {
      closeList()
      out.push(wrapHtmlBlock(htmlBlock.html))
      i = htmlBlock.next
      continue
    }

    if (/^\s*<(img|br|hr)\b[^>]*\/?>/i.test(line)) {
      closeList()
      out.push(wrapHtmlBlock(line.trim()))
      i += 1
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList()
      const header = parseTableCells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        rows.push(parseTableCells(lines[i]))
        i += 1
      }
      out.push(renderTable(header, rows))
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      const size = level === 1 ? 'kb-md-h1' : level === 2 ? 'kb-md-h2' : 'kb-md-h3'
      out.push(`<h${level} class="kb-md-heading ${size}">${renderInline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) {
      if (!inList) {
        out.push('<ul class="kb-md-ul">')
        inList = true
      }
      out.push(`<li>${renderInline(li[1])}</li>`)
      i += 1
      continue
    }

    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (ol) {
      closeList()
      out.push(`<p class="kb-md-ol"><span class="kb-md-ol-num">${ol[1]}.</span>${renderInline(ol[2])}</p>`)
      i += 1
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      closeList()
      out.push(`<blockquote class="kb-md-quote">${renderInline(quote[1])}</blockquote>`)
      i += 1
      continue
    }

    const mdImg = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (mdImg) {
      closeList()
      const safeAlt = escapeHtml(mdImg[1])
      const safeHref = escapeHtml(mdImg[2].trim())
      out.push(
        `<figure class="kb-md-figure"><img class="kb-md-img kb-md-img-pending" alt="${safeAlt}" data-kb-asset-src="${safeHref}" loading="lazy" decoding="async" /></figure>`,
      )
      i += 1
      continue
    }

    if (line.trim().startsWith('```')) {
      closeList()
      i += 1
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      const code = escapeHtml(codeLines.join('\n'))
      out.push(`<pre class="kb-pre"><code class="kb-codeblock">${code}</code></pre>`)
      continue
    }

    if (!line.trim()) {
      closeList()
      i += 1
      continue
    }

    closeList()
    out.push(`<p class="kb-md-p">${renderInline(line)}</p>`)
    i += 1
  }

  closeList()
  return out.join('')
}

export function renderMarkdown(content?: string): string {
  if (!content) return ''
  const key = markdownCacheKey(content)
  const cached = markdownCache.get(key)
  if (cached !== undefined) return cached
  const html = renderMarkdownBody(content)
  if (markdownCache.size >= MARKDOWN_CACHE_MAX) {
    const first = markdownCache.keys().next().value
    if (first !== undefined) markdownCache.delete(first)
  }
  markdownCache.set(key, html)
  return html
}
