import { ref } from 'vue'
import type { RelationDrawerTab } from '@/components/operation/RelationDrawer.vue'
import type { OperationRelationEntityType } from '@/types/operation'

function defaultTab(type: OperationRelationEntityType): RelationDrawerTab {
  if (type === 'server') return 'projects'
  if (type === 'project') return 'servers'
  return 'servers'
}

export function useOperationRelationDrawer() {
  const relationOpen = ref(false)
  const relationType = ref<OperationRelationEntityType>('server')
  const relationId = ref<number | string | null>(null)
  const relationName = ref<string | undefined>()
  const relationTab = ref<RelationDrawerTab>('servers')

  function openRelation(
    type: OperationRelationEntityType,
    id: number | string | null | undefined,
    options?: { name?: string; tab?: RelationDrawerTab },
  ) {
    if (id == null || id === '') return
    relationType.value = type
    relationId.value = id
    relationName.value = options?.name
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
    relationTab,
    openRelation,
    closeRelation,
  }
}
