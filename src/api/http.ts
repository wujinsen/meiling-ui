import type { MoliResult } from '@/types/api'
import { API_AUTH_ERROR_CODE, API_TOKEN_INVALID_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { clearAuthSession, getToken } from '@/utils/authSession'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const DEFAULT_TIMEOUT_MS = 8_000

export async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<MoliResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)
  if (!headers.has('Content-Type') && fetchOptions.body) {
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
      throw new Error('请求超时，请确认后端 moli-server (8888) 已启动')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }

  let result: MoliResult<T>
  try {
    result = await response.json()
  } catch {
    throw new Error('Invalid response')
  }

  if (result.code === API_TOKEN_INVALID_CODE) {
    clearAuthSession()
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
  }

  if (result.code === API_AUTH_ERROR_CODE) {
    const generic = ['无访问权限', '无权限操作']
    const msg = generic.includes(result.msg ?? '') ? '无权限操作' : (result.msg || '无权限操作')
    showToast('error', msg)
  }

  return result
}
