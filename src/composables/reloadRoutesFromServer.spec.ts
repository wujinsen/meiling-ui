import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_SUCCESS_CODE } from '@/types/api'

vi.mock('@/api/menu', () => ({
  getRoutersApi: vi.fn(),
  MENU_DEV_FALLBACK_MSG: '使用前端默认菜单',
}))

vi.mock('@/utils/authSession', () => ({
  clearMenus: vi.fn(),
  getStoredCurrentSystem: vi.fn(),
  getToken: vi.fn(() => 'token'),
  isPortalEnabledStored: vi.fn(),
  saveMenus: vi.fn(),
}))

vi.mock('@/router', () => ({
  router: {
    hasRoute: vi.fn(() => false),
    removeRoute: vi.fn(),
    addRoute: vi.fn(),
  },
}))

import { getRoutersApi } from '@/api/menu'
import { reloadRoutesFromServer, resetDynamicRoutes } from '@/composables/usePermission'
import { getStoredCurrentSystem, isPortalEnabledStored } from '@/utils/authSession'

describe('reloadRoutesFromServer', () => {
  beforeEach(() => {
    vi.mocked(getRoutersApi).mockReset()
    vi.mocked(isPortalEnabledStored).mockReturnValue(false)
    vi.mocked(getStoredCurrentSystem).mockReturnValue(null)
  })

  afterEach(async () => {
    await resetDynamicRoutes()
  })

  it('returns needsSystemSelect when portal on, no current system, and getRouters is empty', async () => {
    vi.mocked(isPortalEnabledStored).mockReturnValue(true)
    vi.mocked(getStoredCurrentSystem).mockReturnValue(null)
    vi.mocked(getRoutersApi).mockResolvedValue({
      code: API_SUCCESS_CODE,
      msg: 'ok',
      data: [],
    })

    const result = await reloadRoutesFromServer({ force: true })

    expect(result).toEqual({ ok: false, needsSystemSelect: true })
  })

  it('applies menus when getRouters returns data', async () => {
    vi.mocked(getRoutersApi).mockResolvedValue({
      code: API_SUCCESS_CODE,
      msg: 'ok',
      data: [
        {
          name: 'Dashboard',
          path: 'dashboard',
          component: 'dashboard/index',
          meta: { title: 'Dashboard' },
        },
      ],
    })

    const result = await reloadRoutesFromServer({ force: true })

    expect(result).toEqual({ ok: true })
  })

  it('uses dev fallback menus when backend is unavailable', async () => {
    vi.mocked(isPortalEnabledStored).mockReturnValue(true)
    vi.mocked(getStoredCurrentSystem).mockReturnValue(null)
    vi.mocked(getRoutersApi).mockResolvedValue({
      code: API_SUCCESS_CODE,
      msg: '使用前端默认菜单',
      data: [{ name: 'Fallback', path: 'dashboard', component: 'dashboard/index' }],
    })

    const result = await reloadRoutesFromServer({ force: true })

    expect(result).toEqual({ ok: true })
  })
})
