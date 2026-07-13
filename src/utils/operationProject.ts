import type { ComposerTranslation } from 'vue-i18n'
import type { OperationProject } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'

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

  const name = (project.projectName || '').trim().toLowerCase()
  const duplicated = Boolean(name && (nameCounts?.get(name) ?? 0) > 1)
  if (duplicated && project.id != null) parts.push(`#${project.id}`)

  return parts.join(' · ')
}
