import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type { NoticeFeed, NoticeQuery, SysNotice } from '@/types/notice'
import { buildEntityQuery, jsonEntityBody } from '@/utils/id'

function buildQuery(params?: Record<string, string | number | undefined>) {
  return buildEntityQuery(params)
}

export async function listNoticeApi(params?: NoticeQuery) {
  return request<PageRes<SysNotice>>(`/notice/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })
}

export async function getNoticeApi(id: number | string) {
  return request<SysNotice>(`/notice/${id}`, { method: 'GET' })
}

export async function addNoticeApi(data: SysNotice) {
  return request<number | string>('/notice', {
    method: 'POST',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function updateNoticeApi(data: SysNotice) {
  return request<boolean>('/notice', {
    method: 'PUT',
    body: jsonEntityBody(data as Record<string, unknown>),
  })
}

export async function publishNoticeApi(id: number | string) {
  return request<boolean>(`/notice/publish/${id}`, { method: 'PUT' })
}

export async function revokeNoticeApi(id: number | string) {
  return request<boolean>(`/notice/revoke/${id}`, { method: 'PUT' })
}

export async function deleteNoticeApi(ids: number | string | Array<number | string>) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request<boolean>(`/notice/${idStr}`, { method: 'DELETE' })
}

export async function getNoticeFeedApi() {
  return request<NoticeFeed>('/notice/feed', { method: 'GET' })
}

export async function getNoticeFeedDetailApi(id: number | string) {
  return request<SysNotice>(`/notice/feed/${id}`, { method: 'GET' })
}

export async function markNoticeFeedReadApi() {
  return request<boolean>('/notice/feed/read', { method: 'PUT' })
}
