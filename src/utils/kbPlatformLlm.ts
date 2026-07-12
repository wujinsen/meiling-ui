/** 兼容后端 Boolean / tinyint / 字符串。 */
export function coerceKbLlmEnabled(value: unknown): boolean {
  if (value === true || value === 1 || value === '1' || value === 'true') return true
  return false
}

/** 平台页状态：enabled 优先于后端 available（关闭后 available 仍可能为 true）。 */
export function resolveKbLlmRuntimeAvailable(
  enabled: unknown,
  apiKeyConfigured?: boolean,
  backendAvailable?: boolean,
): boolean {
  if (!coerceKbLlmEnabled(enabled)) return false
  if (!apiKeyConfigured) return false
  return backendAvailable !== false
}

/** 治理页：govern/options.llmAvailable 未跟 enabled 联动时的前端兜底。 */
export function mergeGovernLlmAvailable(
  governAvailable?: boolean,
  platformEnabled?: unknown,
): boolean {
  return Boolean(governAvailable) && coerceKbLlmEnabled(platformEnabled)
}
