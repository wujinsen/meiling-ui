import { computed, ref } from 'vue'
import { loginApi, logoutApi } from '@/api/auth'
import type { LoginPayload } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import { useSystemPortal } from '@/composables/useSystemPortal'
import { resetDynamicRoutes } from '@/composables/usePermission'
import { resetPageTabs } from '@/composables/usePageTabs'
import { resetToast } from '@/composables/useToast'
import { clearActionPermissions } from '@/composables/useActionPermissions'
import { clearAuthSession, getStoredUser, getToken, saveAuthSession } from '@/utils/authSession'

const token = ref<string | null>(getToken())
const user = ref(getStoredUser())

export { getToken, clearAuthSession } from '@/utils/authSession'

export function initAuth() {
  token.value = getToken()
  user.value = getStoredUser()
}

export function useAuth() {
  const isLoggedIn = computed(() => Boolean(token.value ?? getToken()))
  const displayName = computed(() => user.value?.nickName || user.value?.userName || '')

  async function login(payload: LoginPayload) {
    const result = await loginApi(payload)
    if (result.code !== API_SUCCESS_CODE || !result.data?.token) {
      throw new Error(result.msg || '登录失败')
    }
    token.value = result.data.token
    user.value = result.data.user
    saveAuthSession(result.data.token, result.data.user)
    const { handlePostLogin } = useSystemPortal()
    const nextPath = await handlePostLogin(result.data)
    return { ...result, nextPath }
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      token.value = null
      user.value = null
      clearAuthSession()
      clearActionPermissions()
      useSystemPortal().clearPortalState()
      resetPageTabs()
      resetToast()
      await resetDynamicRoutes()
    }
  }

  function updateStoredUser(partial: Partial<NonNullable<typeof user.value>>) {
    if (!user.value) return
    user.value = { ...user.value, ...partial }
    const currentToken = token.value ?? getToken()
    if (currentToken) {
      saveAuthSession(currentToken, user.value)
    }
  }

  return {
    token,
    user,
    isLoggedIn,
    displayName,
    login,
    logout,
    updateStoredUser,
  }
}
