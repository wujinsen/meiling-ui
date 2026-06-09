import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { PostQuery, SysPost } from '@/types/post'

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export async function listPostApi(params?: PostQuery) {
  return request<PageRes<SysPost>>(`/post/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function getPostApi(id: number | string) {
  return request<SysPost>(`/post/${id}`, { method: 'GET' })
}

export async function addPostApi(data: SysPost) {
  return request<boolean>('/post', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePostApi(data: SysPost) {
  return request<boolean>('/post', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deletePostApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/post/${idStr}`, { method: 'DELETE' })
}

export async function allPostApi() {
  return request<SysPost[]>('/post/allPost', { method: 'GET' })
}
