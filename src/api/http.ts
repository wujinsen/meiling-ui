import type { MoliResult } from '@/types/api'
import { API_TOKEN_INVALID_CODE } from '@/types/api'
import { clearAuthSession, getToken } from '@/utils/authSession'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export async function request<T>(path: string, options: RequestInit = {}): Promise<MoliResult<T>> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const authToken = getToken()
  if (authToken) {
    headers.set('Authorization', authToken)
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

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

  return result
}
