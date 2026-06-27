import { computed, ref } from 'vue'

import { getKbAccessibleSpacesApi } from '@/api/knowledge'

import { API_SUCCESS_CODE } from '@/types/api'

import type { KbAccessibleSpace } from '@/types/knowledge'

import { toEntityId } from '@/utils/id'

const STORAGE_KEY = 'kb_selected_space_id'
const STORAGE_CODE_KEY = 'kb_selected_space_code'

const spaces = ref<KbAccessibleSpace[]>([])

/** null = 全部可读空间；以 spaceCode 为主键，避免雪花 ID 在 JSON 中精度丢失后无法区分空间 */
const selectedSpaceCode = ref<string | null>(readStoredSpaceCode())

const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')

let loadPromise: Promise<void> | null = null

function normalizeSpaceId(value?: number | string | null): string | null {
  const id = toEntityId(value)
  return id ?? null
}

function normalizeSpace(space: KbAccessibleSpace): KbAccessibleSpace {
  const id = normalizeSpaceId(space.id)
  return id ? { ...space, id } : space
}

function readStoredSpaceId(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === '' || raw == null) return null
    if (raw === 'all') return null
    return raw
  } catch {
    return null
  }
}

function readStoredSpaceCode(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_CODE_KEY)
    return raw?.trim() || null
  } catch {
    return null
  }
}

function persistSpaceId(id: string | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id == null ? 'all' : id)
  } catch {
    /* ignore */
  }
}

function persistSpaceCode(code: string | null) {
  try {
    if (code?.trim()) sessionStorage.setItem(STORAGE_CODE_KEY, code.trim())
    else sessionStorage.removeItem(STORAGE_CODE_KEY)
  } catch {
    /* ignore */
  }
}

function findSpaceByCode(code: string | null): KbAccessibleSpace | undefined {
  if (!code) return undefined
  return spaces.value.find((s) => s.spaceCode === code)
}

function findSpacesById(id: string): KbAccessibleSpace[] {
  return spaces.value.filter((s) => normalizeSpaceId(s.id) === id)
}

/** 供 API query 使用：null = 全部可读空间，不传 spaceId */
export function kbQuerySpaceId(spaceId: string | null): string | undefined {
  return spaceId ?? undefined
}

export type KbSpaceQuery = {
  spaceId?: string
  spaceCode?: string
}

/** 当前选中空间 → API 参数（spaceId + spaceCode，避免 lint/sync 缺 code 落默认 enterprise-kb） */
export function kbSpaceQuery(
  spaceCode: string | null,
  spaceList: KbAccessibleSpace[],
): KbSpaceQuery {
  if (!spaceCode) return {}
  const space = spaceList.find((s) => s.spaceCode === spaceCode)
  const spaceId = space ? normalizeSpaceId(space.id) : undefined
  return spaceId ? { spaceId, spaceCode } : { spaceCode }
}

function reconcileSelectionAfterLoad() {
  if (selectedSpaceCode.value) {
    const match = findSpaceByCode(selectedSpaceCode.value)
    if (!match) {
      selectedSpaceCode.value = null
      persistSpaceCode(null)
      persistSpaceId(null)
      return
    }
    persistSpaceId(normalizeSpaceId(match.id))
    return
  }

  const legacyId = readStoredSpaceId()
  if (!legacyId) return

  const matches = findSpacesById(legacyId)
  if (matches.length === 1) {
    selectedSpaceCode.value = matches[0].spaceCode
    persistSpaceCode(matches[0].spaceCode)
    persistSpaceId(normalizeSpaceId(matches[0].id))
    return
  }
  if (matches.length > 1) {
    selectedSpaceCode.value = null
    persistSpaceId(null)
  }
}

export function useKbSpace() {
  const selectedSpaceId = computed(() => {
    const space = findSpaceByCode(selectedSpaceCode.value)
    return space ? normalizeSpaceId(space.id) : null
  })

  const selectedSpace = computed(() => findSpaceByCode(selectedSpaceCode.value) ?? null)

  const hasMultipleSpaces = computed(() => spaces.value.length > 1)

  function resolveSelectedSpace(): KbAccessibleSpace | null {
    return selectedSpace.value
  }

  async function ensureSpacesLoaded(force = false) {
    if (loaded.value && !force) return
    if (loadPromise && !force) {
      await loadPromise
      return
    }

    loading.value = true
    loadError.value = ''

    loadPromise = (async () => {
      try {
        const res = await getKbAccessibleSpacesApi()
        if (res.code !== API_SUCCESS_CODE || !res.data) {
          loadError.value = res.msg || '加载知识空间失败'
          spaces.value = []
          return
        }

        spaces.value = res.data.map(normalizeSpace)
        loaded.value = true
        reconcileSelectionAfterLoad()
      } catch (e) {
        loadError.value = e instanceof Error ? e.message : '加载知识空间失败'
        spaces.value = []
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()

    await loadPromise
  }

  function setSelectedSpaceCode(code: string | null) {
    selectedSpaceCode.value = code
    persistSpaceCode(code)
    const space = findSpaceByCode(code)
    persistSpaceId(space ? normalizeSpaceId(space.id) : null)
  }

  function setSelectedSpaceId(id: string | null) {
    if (id == null) {
      setSelectedSpaceCode(null)
      return
    }
    const matches = findSpacesById(id)
    if (matches.length === 1) {
      setSelectedSpaceCode(matches[0].spaceCode)
      return
    }
    if (matches.length > 1) {
      const stored = readStoredSpaceCode()
      const byCode = stored ? matches.find((m) => m.spaceCode === stored) : undefined
      setSelectedSpaceCode(byCode?.spaceCode ?? matches[0].spaceCode)
      return
    }
    persistSpaceId(id)
  }

  /** 打开文档页时优先用条目/详情里的 spaceId */
  function resolvePageSpaceId(explicit?: number | string | null) {
    const id = normalizeSpaceId(explicit)
    if (id != null) return id
    return kbQuerySpaceId(selectedSpaceId.value)
  }

  function kbSpaceQueryPayload(): KbSpaceQuery {
    return kbSpaceQuery(selectedSpaceCode.value, spaces.value)
  }

  return {
    spaces,
    selectedSpaceId,
    selectedSpaceCode,
    selectedSpace,
    hasMultipleSpaces,
    loading,
    loadError,
    ensureSpacesLoaded,
    setSelectedSpaceId,
    setSelectedSpaceCode,
    kbQuerySpaceId: () => kbQuerySpaceId(selectedSpaceId.value),
    kbSpaceQuery: kbSpaceQueryPayload,
    resolveSelectedSpace,
    resolvePageSpaceId,
  }
}
