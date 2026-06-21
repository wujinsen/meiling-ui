/** 管理员重置密码用随机串（避免易混淆字符 0/O、1/l） */
export function generateRandomPassword(length = 10): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  let pwd = ''
  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i]! % chars.length]
  }
  return pwd
}
