import type {
  AiopsApproveRequest,
  AiopsDiagnoseRequest,
  AiopsDiagnoseStart,
  AiopsHealthStatus,
  AiopsProgressEvent,
  AiopsRejectRequest,
  AiopsRunDetail,
  AiopsRunSummary,
} from '@/types/aiops'

export const AIOPS_BASE = import.meta.env.VITE_AIOPS_BASE_URL ?? '/AiOpsServer'

async function authHeaders(extra?: HeadersInit): Promise<Headers> {
  const { getToken } = await import('@/utils/authSession')
  const headers = new Headers(extra)
  const token = getToken()
  if (token) headers.set('Authorization', token)
  return headers
}

async function aiopsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${AIOPS_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

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

export async function getAiopsHealthApi() {
  return aiopsFetch<AiopsHealthStatus>('/health')
}

export async function listAiopsRunsApi(limit = 50) {
  return aiopsFetch<{ runs: AiopsRunSummary[] }>(`/runs?limit=${limit}`)
}

export async function getAiopsRunApi(runId: string) {
  return aiopsFetch<AiopsRunDetail>(`/runs/${encodeURIComponent(runId)}`)
}

export async function startAiopsDiagnoseApi(payload: AiopsDiagnoseRequest) {
  return aiopsFetch<AiopsDiagnoseStart>('/diagnose', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function approveAiopsRunApi(runId: string, payload: AiopsApproveRequest) {
  return aiopsFetch<{ run_id: string; approved_step_ids: string[]; tokens_issued: number }>(
    `/runs/${encodeURIComponent(runId)}/approve`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function rejectAiopsRunApi(runId: string, payload: AiopsRejectRequest) {
  return aiopsFetch<{ run_id: string; approved: boolean }>(
    `/runs/${encodeURIComponent(runId)}/reject`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export type AiopsSseHandlers = {
  onEvent?: (event: AiopsProgressEvent) => void
  onDone?: (runId: string) => void
  onError?: (message: string) => void
}

/** GET /runs/{runId}/stream — fetch + SSE（带 Authorization） */
export async function subscribeAiopsStream(
  runId: string,
  handlers: AiopsSseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await authHeaders()
  const url = `${import.meta.env.VITE_API_BASE_URL ?? ''}${AIOPS_BASE}/runs/${encodeURIComponent(runId)}/stream`

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
    if (event === 'ping') return
    if (event === 'done') {
      try {
        const parsed = JSON.parse(data) as { run_id?: string }
        handlers.onDone?.(parsed.run_id ?? runId)
      } catch {
        handlers.onDone?.(runId)
      }
      return
    }
    try {
      const parsed = JSON.parse(data) as AiopsProgressEvent
      if (parsed.type === 'error') {
        handlers.onError?.(parsed.message ?? 'diagnosis failed')
        return
      }
      handlers.onEvent?.(parsed)
    } catch {
      handlers.onEvent?.({ type: event, message: data })
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
