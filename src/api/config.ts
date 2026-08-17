import { request } from '@/api/http'
import type { ConfigItem, ConfigUpdateRequest } from '@/types/config'

function buildQuery(params?: Record<string, string | undefined>) {
  if (!params?.group) return ''
  return `?group=${encodeURIComponent(params.group)}`
}

export async function listConfigApi(group?: string) {
  return request<ConfigItem[]>(`/config/list${buildQuery(group ? { group } : undefined)}`, {
    method: 'GET',
  })
}

export async function updateConfigApi(data: ConfigUpdateRequest) {
  return request<boolean>('/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function resetConfigApi(configKey: string) {
  return request<boolean>(`/config/${encodeURIComponent(configKey)}`, {
    method: 'DELETE',
  })
}
