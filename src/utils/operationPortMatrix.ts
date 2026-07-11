/** 矩阵 key 归一化（与后端存储规则一致） */
export function normalizeMatrixKey(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function isValidMatrixKey(key: string) {
  return /^[a-z][a-z0-9-]*$/.test(key)
}
