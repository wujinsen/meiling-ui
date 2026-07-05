import { vi } from 'vitest'

// jsdom 下 i18n 初始化会读 localStorage / document.title
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('meiling-locale', 'zh')
}

vi.mock('@/utils/authSession', () => ({
  getToken: vi.fn(() => 'login_token_test'),
}))

if (typeof URL.createObjectURL !== 'function') {
  // jsdom 部分版本无 blob URL API
  URL.createObjectURL = vi.fn(() => 'blob:mock-image') as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
} else {
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-image')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
}
