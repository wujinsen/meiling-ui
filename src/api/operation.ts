import { request } from '@/api/http'
import type { PageRes } from '@/types/page'
import type {
  ComponentQuery,
  OperationComponent,
  OperationPlatform,
  OperationProject,
  OperationServer,
  OperationServerSsh,
  OperationTopologyGraph,
  OperationRelations,
  OperationRelationEntityType,
  OperationServerLinks,
  OperationProjectLinks,
  OperationProjectComponentLinks,
  OperationComponentLinks,
  OperationPortAudit,
  OperationStats,
  DeployExecAction,
  OperationCommandExec,
  OperationDeployPresets,
  OperationDeployStatus,
  OperationSshTest,
  OperationTask,
  TaskQuery,
  PlatformQuery,
  PortMatrixQuery,
  PortMatrixSaveRequest,
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
export const getServerTagOptionsApi = () => request<string[]>('/operation/server/tag-options', { method: 'GET' })
export const getServerApi = server.get
export const addServerApi = server.add
export const updateServerApi = server.update
export const deleteServerApi = server.remove

/** SVR-25a · 全局拓扑图（ECharts）；与单机关联视图无关 */
export const getTopologyGraphApi = () =>
  request<OperationTopologyGraph>('/operation/topology', { method: 'GET' })

/** SVR-28b · 单实体关联视图（projects/components/recentTasks 等）；替代已删 `GET /server/{id}/topology` */
export const getRelationsApi = (entityType: OperationRelationEntityType, id: number | string) =>
  request<OperationRelations>(`/operation/relations/${entityType}/${id}`, { method: 'GET' })

export const getServerRelationsApi = (id: number | string) => getRelationsApi('server', id)

export const checkServerApi = (id: number | string) =>
  request<OperationServer | number>(`/operation/server/${id}/check`, { method: 'POST' })
export const getServerLinksApi = (id: number | string) =>
  request<OperationServerLinks>(`/operation/server/${id}/links`, { method: 'GET' })
export const saveServerLinksApi = (id: number | string, body: OperationServerLinks) =>
  request<boolean>(`/operation/server/${id}/links`, { method: 'PUT', body: JSON.stringify(body) })

export const getProjectLinksApi = (id: number | string) =>
  request<OperationProjectLinks>(`/operation/project/${id}/links`, { method: 'GET' })
export const saveProjectLinksApi = (id: number | string, body: OperationProjectLinks) =>
  request<boolean>(`/operation/project/${id}/links`, { method: 'PUT', body: JSON.stringify(body) })

export const getProjectComponentLinksApi = (id: number | string) =>
  request<OperationProjectComponentLinks>(`/operation/project/${id}/component-links`, { method: 'GET' })
export const saveProjectComponentLinksApi = (id: number | string, body: OperationProjectComponentLinks) =>
  request<boolean>(`/operation/project/${id}/component-links`, { method: 'PUT', body: JSON.stringify(body) })

export const getComponentLinksApi = (id: number | string) =>
  request<OperationComponentLinks>(`/operation/component/${id}/links`, { method: 'GET' })
export const saveComponentLinksApi = (id: number | string, body: OperationComponentLinks) =>
  request<boolean>(`/operation/component/${id}/links`, { method: 'PUT', body: JSON.stringify(body) })
export const saveServerSshApi = (id: number | string, body: OperationServerSsh) =>
  request<boolean>(`/operation/server/${id}/ssh`, { method: 'PUT', body: JSON.stringify(body) })
export const testServerSshApi = (id: number | string) =>
  request<OperationSshTest>(`/operation/server/${id}/ssh/test`, { method: 'POST', timeoutMs: 30_000 })
export const probeAllHealthApi = () =>
  request<number>('/operation/health/probe-all', { method: 'POST', timeoutMs: 15_000 })

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

const portMatrix = createCrudApi<PortMatrixSaveRequest>('/operation/port-matrix')

export const listPortMatrixApi = (params?: PortMatrixQuery) =>
  portMatrix.list(params as Record<string, string | number | undefined>)
export const getPortMatrixApi = portMatrix.get
export const addPortMatrixApi = portMatrix.add
export const updatePortMatrixApi = portMatrix.update
export const deletePortMatrixApi = portMatrix.remove

export const getOperationStatsApi = () =>
  request<OperationStats>('/operation/stats', { method: 'GET' })

export const getDeployStatusApi = (serviceKey: string, serverId?: number | string | null) => {
  const qs = serverId != null && serverId !== '' ? `?serverId=${serverId}` : ''
  return request<OperationDeployStatus>(`/operation/deploy/${serviceKey}/status${qs}`, { method: 'GET', timeoutMs: 30_000 })
}

export const execDeployApi = (serviceKey: string, action: DeployExecAction, serverId?: number | string | null) => {
  const qs = serverId != null && serverId !== '' ? `?serverId=${serverId}` : ''
  return request<OperationDeployStatus>(`/operation/deploy/${serviceKey}/${action}${qs}`, { method: 'POST', timeoutMs: 60_000 })
}

export const createDeployTaskApi = (
  serviceKey: string,
  action: DeployExecAction,
  serverId?: number | string | null,
  projectId?: number | string | null,
) => {
  const params = new URLSearchParams()
  if (serverId != null && serverId !== '') params.set('serverId', String(serverId))
  if (projectId != null && projectId !== '') params.set('projectId', String(projectId))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<number>(`/operation/deploy/${serviceKey}/${action}/task${qs}`, { method: 'POST', timeoutMs: 15_000 })
}

export const getTaskApi = (id: number | string, logOffset = 0) =>
  request<OperationTask>(`/operation/task/${id}?logOffset=${logOffset}`, { method: 'GET', timeoutMs: 15_000 })

export const listTaskApi = (params?: TaskQuery) =>
  request<PageRes<OperationTask>>(`/operation/task/list${buildQuery(params as Record<string, string | number | undefined>)}`, {
    method: 'GET',
  })

export const uploadFileApi = (formData: FormData) =>
  request<number>('/operation/file/upload', { method: 'POST', body: formData, timeoutMs: 600_000 })

export const getDeployPresetsApi = (serverId?: number | string | null) => {
  const qs = serverId != null && serverId !== '' ? `?serverId=${serverId}` : ''
  return request<OperationDeployPresets>(`/operation/deploy/presets${qs}`, { method: 'GET' })
}

export const createCommandTaskApi = (body: OperationCommandExec) =>
  request<number>('/operation/command/exec/task', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 15_000,
  })
