import { request } from '@/api/http'
import type { KbResearchProgress, KbResearchRequest, KbResearchResult, KbResearchStart } from '@/types/knowledge'
import { KB_BASE, jsonEntityBody } from './core'

function parseSseBlocks(buffer: string, onBlock: (event: string, data: string) => void): string {
  const parts = buffer.split('\n\n')
  const remainder = parts.pop() ?? ''
  for (const block of parts) {
    if (!block.trim()) continue
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length) onBlock(event, dataLines.join('\n'))
  }
  return remainder
}

/** Spring SseEmitter.data(JSON 字符串) 时可能多包一层引号 */
function parseSseJson(data: string): Record<string, unknown> {
  let parsed: unknown = JSON.parse(data)
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return { message: parsed }
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  return { message: data }
}

export type KbResearchSseHandlers = {
  onProgress?: (evt: KbResearchProgress) => void
  onComplete?: (result: KbResearchResult) => void
  onError?: (message: string) => void
}

/** POST /kb/research/start — 启动调研（异步，返回 runId） */
export async function startKbResearchApi(payload: KbResearchRequest) {
  return request<KbResearchStart>(`${KB_BASE}/research/start`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 120_000,
  })
}

/** GET /kb/research/{runId} — 状态与结果摘要 */
export async function getKbResearchApi(runId: string) {
  return request<KbResearchResult>(`${KB_BASE}/research/${encodeURIComponent(runId)}`, { method: 'GET' })
}

/** GET /kb/research/{runId}/stream — fetch + SSE（带 Authorization） */
export async function subscribeKbResearchStream(
  runId: string,
  handlers: KbResearchSseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const { getToken } = await import('@/utils/authSession')
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const url = `${base}${KB_BASE}/research/${encodeURIComponent(runId)}/stream`
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = token

  const res = await fetch(url, { headers, signal })
  if (!res.ok) {
    throw new Error(`SSE 连接失败 (HTTP ${res.status})`)
  }
  if (!res.body) {
    throw new Error('SSE 响应无 body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (event: string, data: string) => {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = parseSseJson(data)
    } catch {
      parsed = { message: data }
    }
    switch (event) {
      case 'progress':
        handlers.onProgress?.(parsed as KbResearchProgress)
        break
      case 'complete':
        handlers.onComplete?.(parsed as KbResearchResult)
        break
      case 'error': {
        const msg = typeof parsed.message === 'string' ? parsed.message : 'research failed'
        handlers.onError?.(msg)
        throw new Error(msg)
      }
      default:
        break
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = parseSseBlocks(buffer, dispatch)
  }
  buffer = parseSseBlocks(`${buffer}\n\n`, dispatch)
}
