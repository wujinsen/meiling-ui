import type { KbCategoryFlatOption, KbCategoryTree } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

export function flattenKbCategoryTree(
  nodes: KbCategoryTree[],
  depth = 0,
  prefix = '　',
): KbCategoryFlatOption[] {
  const out: KbCategoryFlatOption[] = []
  for (const node of nodes) {
    const id = toEntityId(node.id)
    if (!id) continue
    const indent = depth > 0 ? `${prefix.repeat(depth)}└ ` : ''
    out.push({
      id,
      label: `${indent}${node.categoryName}`,
      depth,
    })
    if (node.children?.length) {
      out.push(...flattenKbCategoryTree(node.children, depth + 1, prefix))
    }
  }
  return out
}

export function findKbCategoryName(nodes: KbCategoryTree[], id: string): string | undefined {
  for (const node of nodes) {
    if (toEntityId(node.id) === id) return node.categoryName
    if (node.children?.length) {
      const found = findKbCategoryName(node.children, id)
      if (found) return found
    }
  }
  return undefined
}
