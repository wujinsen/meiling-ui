import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type {
  ComponentQuery,
  OperationComponent,
  OperationPlatform,
  OperationProject,
  OperationServer,
  OperationServerTopology,
  OperationServerLinks,
  OperationPortAudit,
  OperationStats,
  DeployExecAction,
  OperationDeployStatus,
  OperationHealthProbeResult,
  PlatformQuery,
  ProjectQuery,
  ServerQuery,
} from '@/types/operation'

export type OperationSecretReveal = {
  password?: string
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

function createCrudApi<T>(base: string) {
  return {
    list(params?: Record<string, string | number | undefined>) {
      return request<PageRes<T>>(`${base}/list${buildQuery(params)}`, { method: 'GET' })
    },
    get(id: number | string) {
      return request<T>(`${base}/${id}`, { method: 'GET' })
    },
    add(data: T) {
      return request<boolean>(base, { method: 'POST', body: JSON.stringify(data) })
    },
    update(data: T) {
      return request<boolean>(base, { method: 'PUT', body: JSON.stringify(data) })
    },
    remove(ids: number | string | Array<number | string>) {
      const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
      return request<boolean>(`${base}/${idStr}`, { method: 'DELETE' })
    },
  }
}

const project = createCrudApi<OperationProject>('/operation/project')
const server = createCrudApi<OperationServer>('/operation/server')
const platform = createCrudApi<OperationPlatform>('/operation/platform')
const component = createCrudApi<OperationComponent>('/operation/component')

export const listProjectApi = (params?: ProjectQuery) => project.list(params as Record<string, string | number | undefined>)
export const getProjectApi = project.get
export const addProjectApi = project.add
export const updateProjectApi = project.update
export const deleteProjectApi = project.remove

export const listServerApi = (params?: ServerQuery) => server.list(params as Record<string, string | number | undefined>)
export const getServerApi = server.get
export const addServerApi = server.add
export const updateServerApi = server.update
export const deleteServerApi = server.remove
export const getServerTopologyApi = (id: number | string) =>
  request<OperationServerTopology>(`/operation/server/${id}/topology`, { method: 'GET' })
export const checkServerApi = (id: number | string) =>
  request<OperationServer>(`/operation/server/${id}/check`, { method: 'POST' })
export const getServerLinksApi = (id: number | string) =>
  request<OperationServerLinks>(`/operation/server/${id}/links`, { method: 'GET' })
export const saveServerLinksApi = (id: number | string, body: OperationServerLinks) =>
  request<boolean>(`/operation/server/${id}/links`, { method: 'PUT', body: JSON.stringify(body) })
export const probeAllHealthApi = () =>
  request<OperationHealthProbeResult>('/operation/health/probe-all', { method: 'POST' })

export const listPlatformApi = (params?: PlatformQuery) => platform.list(params as Record<string, string | number | undefined>)
export const getPlatformApi = platform.get
export const addPlatformApi = platform.add
export const updatePlatformApi = platform.update
export const deletePlatformApi = platform.remove
export const revealPlatformSecretApi = (id: number | string) =>
  request<OperationSecretReveal>(`/operation/platform/${id}/secret`, { method: 'GET' })

export const listComponentApi = (params?: ComponentQuery) => component.list(params as Record<string, string | number | undefined>)
export const getComponentApi = component.get
export const addComponentApi = component.add
export const updateComponentApi = component.update
export const deleteComponentApi = component.remove
export const revealComponentSecretApi = (id: number | string) =>
  request<OperationSecretReveal>(`/operation/component/${id}/secret`, { method: 'GET' })
export const checkComponentApi = (id: number | string) =>
  request<OperationComponent>(`/operation/component/${id}/check`, { method: 'POST' })

export const getPortAuditApi = () =>
  request<OperationPortAudit>('/operation/audit/port-matrix', { method: 'GET' })

export const getOperationStatsApi = () =>
  request<OperationStats>('/operation/stats', { method: 'GET' })

export const getDeployStatusApi = (serviceKey: string) =>
  request<OperationDeployStatus>(`/operation/deploy/${serviceKey}/status`, { method: 'GET' })

export const execDeployApi = (serviceKey: string, action: DeployExecAction) =>
  request<OperationDeployStatus>(`/operation/deploy/${serviceKey}/${action}`, { method: 'POST' })
