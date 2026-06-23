import { computed, ref } from 'vue'
import { getKbAccessibleSpacesApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbAccessibleSpace } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

const STORAGE_KEY = 'kb_selected_space_id'

const spaces = ref<KbAccessibleSpace[]>([])
/** null = 全部可读空间；字符串避免雪花 ID 精度丢失 */
const selectedSpaceId = ref<string | null>(readStoredSpaceId())
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')

let loadPromise: Promise<void> | null = null

function normalizeSpaceId(value?: number | string | null): string | null {
  const id = toEntityId(value)
  return id ?? null
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

function persistSpaceId(id: string | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id == null ? 'all' : id)
  } catch {
    /* ignore */
  }
}

/** 供 API query 使用：null = 全部可读空间，不传 spaceId */
export function kbQuerySpaceId(spaceId: string | null): string | undefined {
  return spaceId ?? undefined
}

export function useKbSpace() {
  const selectedSpace = computed(
    () => spaces.value.find((s) => normalizeSpaceId(s.id) === selectedSpaceId.value) ?? null,
  )

  const hasMultipleSpaces = computed(() => spaces.value.length > 1)

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
        spaces.value = res.data
        loaded.value = true
        if (selectedSpaceId.value != null) {
          const ok = spaces.value.some((s) => normalizeSpaceId(s.id) === selectedSpaceId.value)
          if (!ok) {
            selectedSpaceId.value = null
            persistSpaceId(null)
          }
        }
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

  function setSelectedSpaceId(id: string | null) {
    selectedSpaceId.value = id
    persistSpaceId(id)
  }

  /** 打开文档页时优先用条目/详情里的 spaceId */
  function resolvePageSpaceId(explicit?: number | string | null) {
    const id = normalizeSpaceId(explicit)
    if (id != null) return id
    return kbQuerySpaceId(selectedSpaceId.value)
  }

  return {
    spaces,
    selectedSpaceId,
    selectedSpace,
    hasMultipleSpaces,
    loading,
    loadError,
    ensureSpacesLoaded,
    setSelectedSpaceId,
    kbQuerySpaceId: () => kbQuerySpaceId(selectedSpaceId.value),
    resolvePageSpaceId,
  }
}
