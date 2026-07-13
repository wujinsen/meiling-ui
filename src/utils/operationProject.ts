import type { ComposerTranslation } from 'vue-i18n'
import type { OperationProject } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'

/** W9 走查种子项目 remark 标记（见 npm run op:seed:w9） */
export const W9_BATCH_PROJECT_MARKER = 'w9-batch-smoke'

/** 部署中心下拉主标题：W9 种子用 remark 标记，避免与 moli-user-center 混淆 */
export function resolveProjectDisplayName(project: OperationProject): string {
  if (project.remark?.includes(W9_BATCH_PROJECT_MARKER)) return W9_BATCH_PROJECT_MARKER
  const name = project.projectName?.trim()
  if (name) return name
  return project.id != null ? `#${project.id}` : ''
}

/** 统计项目名出现次数，用于同名时追加区分信息 */
export function projectNameCounts(projects: OperationProject[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const name = (project.projectName || '').trim().toLowerCase()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}

/** 部署中心等项目下拉的副标题：环境 · IP · 端口；同名时追加 #id */
export function formatProjectPickHint(
  project: OperationProject,
  t: ComposerTranslation,
  nameCounts?: Map<string, number>,
): string {
  const parts: string[] = []
  if (project.environment) parts.push(t(environmentI18nKey(project.environment)))
  const ip = project.innerIp || project.serverIp
  if (ip) parts.push(ip)
  if (project.port) parts.push(String(project.port))
  if (project.remark?.includes(W9_BATCH_PROJECT_MARKER)) parts.push('user-center')

  const name = (project.projectName || '').trim().toLowerCase()
  const duplicated = Boolean(name && (nameCounts?.get(name) ?? 0) > 1)
  if (duplicated && project.id != null) parts.push(`#${project.id}`)

  return parts.join(' · ')
}
