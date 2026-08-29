import type { MoliResult } from '@/types/api'
import { API_AUTH_ERROR_CODE, API_SUCCESS_CODE, API_TOKEN_INVALID_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { clearAuthSession, getToken } from '@/utils/authSession'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const DEFAULT_TIMEOUT_MS = 8_000

/** Quote ≥16-digit JSON integers before parse — snowflake IDs exceed Number.MAX_SAFE_INTEGER. */
function quoteBigIntegersOutsideStrings(input: string): string {
  let out = ''
  let i = 0
  let inString = false
  let escaped = false

  while (i < input.length) {
    const ch = input[i]!

    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      i++
      continue
    }

    const rest = input.slice(i)
    const m = rest.match(/^([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/)
    if (m) {
      out += m[1] + '"' + m[2] + '"'
      i += m[0].length
      continue
    }

    out += ch
    i++
  }

  return out
}

function parseResponseJson<T>(text: string): T {
  const safe = quoteBigIntegersOutsideStrings(text)
  return JSON.parse(safe) as T
}

export async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<MoliResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)
  if (!headers.has('Content-Type') && fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const authToken = getToken()
  if (authToken) {
    headers.set('Authorization', authToken)
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      const sec = Math.round(timeoutMs / 1000)
      throw new Error(`请求超时（${sec}s）：${path.startsWith('/KnowledgeServer') ? '请确认知识库服务 (28104) 已启动' : '请确认后端 user-center (28101) 已启动'}`)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }

  let result: MoliResult<T>
  try {
    const text = await response.text()
    result = parseResponseJson<MoliResult<T>>(text)
  } catch {
    if (response.status === 405) {
      throw new Error(
        '接口 405：nginx 未将 API 转发到后端。请配置反向代理（见 deploy/nginx.conf.example），或构建时设置 VITE_API_BASE_URL 指向 moli-server',
      )
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      throw new Error(
        `接口返回 HTML（HTTP ${response.status}），请检查部署：静态站点需反代 /login 等到后端 28101`,
      )
    }
    throw new Error('Invalid response')
  }

  if (result.code === API_TOKEN_INVALID_CODE) {
    clearAuthSession()
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '')
    const loginPrefix = `${base}/login`
    if (!window.location.pathname.startsWith(loginPrefix)) {
      const { default: router } = await import('@/router')
      const path = window.location.pathname + window.location.search
      const home = base || '/'
      await router.replace({
        name: 'login',
        query: path !== home && path !== `${home}/` ? { redirect: path } : undefined,
      })
    }
  }

  if (result.code === API_AUTH_ERROR_CODE) {
    const generic = ['无访问权限', '无权限操作']
    const msg = generic.includes(result.msg ?? '') ? '无权限操作' : (result.msg || '无权限操作')
    showToast('error', msg)
  }

  if (result.code === API_SUCCESS_CODE) {
    void import('@/composables/useActionPermissions').then(({ refreshPermissionsIfApiHint }) => {
      refreshPermissionsIfApiHint(result.msg)
    })
  }

  return result
}
