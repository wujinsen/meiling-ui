import { computed, ref, watch, type Ref } from 'vue'
import { getKbCategoryTreeApi, listKbTagsApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbCategoryTree, KbTag } from '@/types/knowledge'
import { flattenKbCategoryTree } from '@/utils/kbCategoryTree'

export function useKbDocMeta(spaceId: Ref<string>) {
  const categories = ref<KbCategoryTree[]>([])
  const tags = ref<KbTag[]>([])
  const loading = ref(false)
  const loadError = ref('')

  const flatCategories = computed(() => flattenKbCategoryTree(categories.value))

  async function load() {
    if (!spaceId.value) {
      categories.value = []
      tags.value = []
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      const [catRes, tagRes] = await Promise.all([
        getKbCategoryTreeApi(spaceId.value, true),
        listKbTagsApi(spaceId.value),
      ])
      if (catRes.code !== API_SUCCESS_CODE || !catRes.data) {
        throw new Error(catRes.msg || 'load categories failed')
      }
      if (tagRes.code !== API_SUCCESS_CODE || !tagRes.data) {
        throw new Error(tagRes.msg || 'load tags failed')
      }
      categories.value = catRes.data
      tags.value = tagRes.data
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : 'load meta failed'
      categories.value = []
      tags.value = []
    } finally {
      loading.value = false
    }
  }

  watch(spaceId, () => void load(), { immediate: true })

  return {
    categories,
    tags,
    flatCategories,
    loading,
    loadError,
    reload: load,
  }
}
