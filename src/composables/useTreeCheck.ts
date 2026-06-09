import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { collectTreeIds } from '@/utils/tree'

type TreeNode = { id?: number | string; children?: TreeNode[] }

export function useTreeCheck() {
  const { t } = useI18n()
  const checked = ref(new Set<string>())

  const isFullyUnchecked = computed(() => checked.value.size === 0)

  const treeCheckLabel = computed(() =>
    isFullyUnchecked.value ? t('common.selectAll') : t('common.clearAll'),
  )

  function checkAll(tree: TreeNode[]) {
    checked.value = new Set(collectTreeIds(tree))
  }

  function clearAll() {
    checked.value = new Set()
  }

  function toggleTreeCheck(tree: TreeNode[]) {
    if (isFullyUnchecked.value) checkAll(tree)
    else clearAll()
  }

  return {
    checked,
    isFullyUnchecked,
    treeCheckLabel,
    checkAll,
    clearAll,
    toggleTreeCheck,
  }
}
