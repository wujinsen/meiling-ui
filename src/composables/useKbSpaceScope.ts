import { computed, ref } from 'vue'

import { useKbSpace } from '@/composables/useKbSpace'

import type { KbAccessibleSpace } from '@/types/knowledge'

import { toEntityId } from '@/utils/id'

const STORAGE_KEY = 'kb_scope_space_ids'

function readStoredScopeIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((id) => String(id)).filter(Boolean)
  } catch {
    return []
  }
}

function persistScopeIds(ids: string[]) {
  try {
    if (!ids.length) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

const scopeSpaceIds = ref<string[]>(readStoredScopeIds())

/** 文档浏览：默认全部可读空间；可勾选若干 spaceId 子集 */
export function useKbSpaceScope() {
  const { spaces, ensureSpacesLoaded } = useKbSpace()

  const isAllSpaces = computed(() => scopeSpaceIds.value.length === 0)

  function reconcileScopeWithSpaces() {
    if (!scopeSpaceIds.value.length) return
    const allowed = new Set(spaces.value.map((s) => toEntityId(s.id)).filter(Boolean) as string[])
    const next = scopeSpaceIds.value.filter((id) => allowed.has(id))
    if (next.length !== scopeSpaceIds.value.length) {
      scopeSpaceIds.value = next
      persistScopeIds(next)
    }
  }

  function selectAllSpaces() {
    scopeSpaceIds.value = []
    persistScopeIds([])
  }

  function toggleSpaceId(id: string) {
    const normalized = toEntityId(id)
    if (!normalized) return
    const set = new Set(scopeSpaceIds.value)
    if (set.has(normalized)) set.delete(normalized)
    else set.add(normalized)
    const next = [...set]
    scopeSpaceIds.value = next
    persistScopeIds(next)
  }

  function isSpaceSelected(id: string) {
    const normalized = toEntityId(id)
    if (!normalized) return false
    if (isAllSpaces.value) return false
    return scopeSpaceIds.value.includes(normalized)
  }

  function setScopeSpaceIds(ids: string[]) {
    const normalized = ids.map((id) => toEntityId(id)).filter(Boolean) as string[]
    scopeSpaceIds.value = normalized
    persistScopeIds(normalized)
  }

  function spaceLabel(space: KbAccessibleSpace) {
    const privateMark = space.visibility === 0 ? ' · 私有' : ''
    return `${space.spaceName ?? ''}${privateMark}`
  }

  async function ensureScopeReady() {
    await ensureSpacesLoaded()
    reconcileScopeWithSpaces()
  }

  return {
    scopeSpaceIds,
    isAllSpaces,
    selectAllSpaces,
    toggleSpaceId,
    isSpaceSelected,
    setScopeSpaceIds,
    spaceLabel,
    ensureScopeReady,
    reconcileScopeWithSpaces,
  }
}
