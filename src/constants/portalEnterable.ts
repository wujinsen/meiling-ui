import type { SystemVo } from '@/types/system'

/** 当前已就绪、可点击进入的业务系统 */
export const PORTAL_READY_SYSTEM_CODE = 'moli-admin'

export function isPortalSystemReady(system: SystemVo): boolean {
  return system.systemCode === PORTAL_READY_SYSTEM_CODE
}
