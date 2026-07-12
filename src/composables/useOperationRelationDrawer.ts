import { ref } from 'vue'
import type { RelationDrawerTab } from '@/components/operation/RelationDrawer.vue'
import type { Environment, OperationRelationEntityType } from '@/types/operation'

function defaultTab(type: OperationRelationEntityType): RelationDrawerTab {
  if (type === 'server') return 'projects'
  if (type === 'project') return 'servers'
  if (type === 'platform') return 'servers'
  return 'servers'
}

export function useOperationRelationDrawer() {
  const relationOpen = ref(false)
  const relationType = ref<OperationRelationEntityType>('server')
  const relationId = ref<number | string | null>(null)
  const relationName = ref<string | undefined>()
  const relationEnvironment = ref<Environment | number | null | undefined>()
  const relationTab = ref<RelationDrawerTab>('servers')

  function openRelation(
    type: OperationRelationEntityType,
    id: number | string | null | undefined,
    options?: { name?: string; tab?: RelationDrawerTab; environment?: Environment | number | null },
  ) {
    if (id == null || id === '') return
    relationType.value = type
    relationId.value = id
    relationName.value = options?.name
    relationEnvironment.value = options?.environment
    relationTab.value = options?.tab ?? defaultTab(type)
    relationOpen.value = true
  }

  function closeRelation() {
    relationOpen.value = false
  }

  return {
    relationOpen,
    relationType,
    relationId,
    relationName,
    relationEnvironment,
    relationTab,
    openRelation,
    closeRelation,
  }
}
