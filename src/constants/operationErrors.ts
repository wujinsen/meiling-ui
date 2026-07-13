/** 与后端 OperationErrorCode 对齐（10101–10109） */
export const OPERATION_ERR_SSH_NOT_CONFIGURED = 10101
export const OPERATION_ERR_SSH_CONNECT_FAILED = 10102
export const OPERATION_ERR_DEPLOY_SCRIPT_MISSING = 10103
export const OPERATION_ERR_UPLOAD_PATH_DENIED = 10104
export const OPERATION_ERR_TASK_NOT_FOUND = 10105
export const OPERATION_ERR_SERVER_NOT_FOUND = 10106
export const OPERATION_ERR_SERVER_TASK_RUNNING = 10107
export const OPERATION_ERR_COMMAND_DENIED = 10108
export const OPERATION_ERR_DEPLOY_DISABLED = 10109

const I18N_KEY_BY_CODE: Record<number, string> = {
  [OPERATION_ERR_SSH_NOT_CONFIGURED]: 'operation.errors.10101',
  [OPERATION_ERR_SSH_CONNECT_FAILED]: 'operation.errors.10102',
  [OPERATION_ERR_DEPLOY_SCRIPT_MISSING]: 'operation.errors.10103',
  [OPERATION_ERR_UPLOAD_PATH_DENIED]: 'operation.errors.10104',
  [OPERATION_ERR_TASK_NOT_FOUND]: 'operation.errors.10105',
  [OPERATION_ERR_SERVER_NOT_FOUND]: 'operation.errors.10106',
  [OPERATION_ERR_SERVER_TASK_RUNNING]: 'operation.errors.10107',
  [OPERATION_ERR_COMMAND_DENIED]: 'operation.errors.10108',
  [OPERATION_ERR_DEPLOY_DISABLED]: 'operation.errors.10109',
}

export function operationErrorI18nKey(code?: number | null): string | null {
  if (code == null) return null
  return I18N_KEY_BY_CODE[code] ?? null
}

/** S-ERR-1：运营 API 失败文案；优先 10101–10109 i18n，其次后端 msg */
export function resolveOperationErrorMessage(
  t: (key: string) => string,
  code?: number | null,
  msg?: string | null,
  fallback?: string,
): string {
  const key = operationErrorI18nKey(code)
  if (key) return t(key)
  const trimmed = msg?.trim()
  if (trimmed) return trimmed
  return fallback ?? ''
}
