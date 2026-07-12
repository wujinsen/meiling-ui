import { computed, ref, watch, type Reactive } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { getComponentApi, getProjectApi, getServerApi } from '@/api/operation'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationRelationEntityType } from '@/types/operation'

export type RelationListPage = 'project' | 'component' | 'server'

export type RelationFilterKey = 'serverId' | 'projectId' | 'componentId'

const PAGE_FILTER_KEYS: Record<RelationListPage, RelationFilterKey[]> = {
  project: ['serverId', 'componentId'],
  component: ['serverId', 'projectId'],
  server: ['projectId', 'componentId'],
}

const KEY_ENTITY: Record<RelationFilterKey, OperationRelationEntityType> = {
  serverId: 'server',
  projectId: 'project',
  componentId: 'component',
}

export type RelationListQuery = {
  pageNum: number
  serverId?: string
  projectId?: string
  componentId?: string
}

export function useOperationRelationListFilter(
  page: RelationListPage,
  query: Reactive<RelationListQuery>,
  route: RouteLocationNormalizedLoaded,
  router: Router,
  onFiltersChange?: () => void,
) {
  const labelMap = ref<Partial<Record<RelationFilterKey, string>>>({})

  async function resolveLabel(key: RelationFilterKey, id: string) {
    try {
      if (key === 'serverId') {
        const result = await getServerApi(id)
        if (result.code === API_SUCCESS_CODE && result.data) {
          labelMap.value.serverId = result.data.serverName || result.data.ip || id
        }
      } else if (key === 'projectId') {
        const result = await getProjectApi(id)
        if (result.code === API_SUCCESS_CODE && result.data) {
          labelMap.value.projectId = result.data.projectName || id
        }
      } else {
        const result = await getComponentApi(id)
        if (result.code === API_SUCCESS_CODE && result.data) {
          labelMap.value.componentId = result.data.componentName || id
        }
      }
    } catch {
      labelMap.value[key] = `#${id}`
    }
  }

  function applyQueryFromRoute() {
    for (const key of PAGE_FILTER_KEYS[page]) {
      const raw = route.query[key]
      const val = typeof raw === 'string' ? raw.trim() : ''
      query[key] = val
      if (val) void resolveLabel(key, val)
      else delete labelMap.value[key]
    }
  }

  function clearFilter(key: RelationFilterKey) {
    query[key] = ''
    delete labelMap.value[key]
    query.pageNum = 1
    const nextQuery = { ...route.query }
    delete nextQuery[key]
    void router.replace({ path: route.path, query: nextQuery })
    onFiltersChange?.()
  }

  const activeFilters = computed(() =>
    PAGE_FILTER_KEYS[page]
      .filter((key) => Boolean(query[key]))
      .map((key) => ({
        key,
        id: query[key] as string,
        entityType: KEY_ENTITY[key],
        label: labelMap.value[key] || `#${query[key]}`,
      })),
  )

  watch(
    () => [route.query.serverId, route.query.projectId, route.query.componentId] as const,
    () => {
      applyQueryFromRoute()
      onFiltersChange?.()
    },
  )

  return { activeFilters, applyQueryFromRoute, clearFilter }
}
