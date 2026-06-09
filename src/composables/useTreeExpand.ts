import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { collectTreeIds } from '@/utils/tree'

type TreeNode = { id?: number | string; children?: TreeNode[] }

export function useTreeExpand() {
  const { t } = useI18n()
  const expanded = ref(new Set<string>())

  const isFullyCollapsed = computed(() => expanded.value.size === 0)

  const treeExpandLabel = computed(() =>
    isFullyCollapsed.value ? t('common.expandAll') : t('common.collapseAll'),
  )

  function toggleExpand(id: string) {
    const next = new Set(expanded.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expanded.value = next
  }

  function expandAll(tree: TreeNode[]) {
    expanded.value = new Set(collectTreeIds(tree))
  }

  function collapseAll() {
    expanded.value = new Set()
  }

  function toggleTreeExpand(tree: TreeNode[]) {
    if (isFullyCollapsed.value) expandAll(tree)
    else collapseAll()
  }

  function expandAllIfEmpty(tree: TreeNode[]) {
    if (!expanded.value.size) expandAll(tree)
  }

  return {
    expanded,
    isFullyCollapsed,
    treeExpandLabel,
    toggleExpand,
    expandAll,
    collapseAll,
    toggleTreeExpand,
    expandAllIfEmpty,
  }
}
