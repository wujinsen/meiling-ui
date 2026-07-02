import { computed, ref } from 'vue'
import { getKbMetaKbTypesApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbMetaKbTypeOption } from '@/types/knowledge'

let cachedOptions: KbMetaKbTypeOption[] | null = null
let inflight: Promise<KbMetaKbTypeOption[]> | null = null

/** GET /kb/meta/kb-types — value→label，供列表体裁徽标等复用 */
export function useKbMetaKbTypes() {
  const options = ref<KbMetaKbTypeOption[]>(cachedOptions ?? [])
  const loading = ref(false)

  const labelMap = computed(() => {
    const map = new Map<string, string>()
    for (const opt of options.value) map.set(opt.value, opt.label)
    return map
  })

  function kbTypeLabel(value?: string | null) {
    if (!value) return ''
    return labelMap.value.get(value) ?? value
  }

  async function ensureLoaded() {
    if (cachedOptions?.length) {
      options.value = cachedOptions
      return cachedOptions
    }
    if (inflight) return inflight

    loading.value = true
    inflight = (async () => {
      try {
        const res = await getKbMetaKbTypesApi()
        if (res.code === API_SUCCESS_CODE && res.data?.length) {
          cachedOptions = res.data
          options.value = res.data
          return res.data
        }
      } catch {
        /* fallback to raw value in kbTypeLabel */
      }
      return options.value
    })().finally(() => {
      loading.value = false
      inflight = null
    })

    return inflight
  }

  return { options, loading, kbTypeLabel, ensureLoaded }
}
