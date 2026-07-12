import { relationColor } from '@/utils/kbGraphTheme'

/** 拓扑图边类型：deploys 实线、depends_on 虚线（对齐关系图谱线型语义） */
export const TOPOLOGY_DASHED_LINKS = new Set(['depends_on'])

export function topologyLinkColor(type: string | undefined, dark: boolean): string {
  return relationColor(type, dark)
}

export function topologyLinkLabelKey(type: string): string {
  return `operation.topology.relation.${type}`
}
