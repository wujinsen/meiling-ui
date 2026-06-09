import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getUserProfileApi,
  resetUserPasswordApi,
  updateUserLanguageApi,
  updateUserProfileApi,
} from '@/api/user'
import { useAuth } from '@/composables/useAuth'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { SysUserVo } from '@/types/user'
import { setLocale, type AppLocale } from '@/i18n'

export type ProfileTab = 'info' | 'password'

export function createProfileForm(): SysUserVo {
  return {
    nickName: '',
    telephone: '',
    email: '',
    sex: 0,
    language: 'zh',
  }
}

export function createPasswordForm() {
  return {
    newPassword: '',
    confirmPassword: '',
  }
}

export function useProfile() {
  const { t } = useI18n()
  const { user, updateStoredUser } = useAuth()

  const loading = ref(false)
  const saving = ref(false)
  const activeTab = ref<ProfileTab>('info')
  const profile = ref<SysUserVo | null>(null)
  const form = ref<SysUserVo>(createProfileForm())
  const passwordForm = ref(createPasswordForm())

  function applyProfile(data: SysUserVo) {
    profile.value = data
    form.value = {
      id: data.id,
      userName: data.userName,
      nickName: data.nickName ?? '',
      telephone: data.telephone ?? '',
      email: data.email ?? '',
      sex: data.sex === 1 ? 1 : 0,
      language: data.language ?? 'zh',
      deptName: data.deptName,
      postNames: data.postNames,
      status: data.status,
      createTime: data.createTime,
    }
  }

  async function load() {
    loading.value = true
    try {
      const result = await getUserProfileApi()
      if (result.code !== API_SUCCESS_CODE || !result.data) {
        throw new Error(result.msg || t('profile.loadFailed'))
      }
      applyProfile(result.data)
    } catch (e) {
      const fallback: SysUserVo = {
        id: user.value?.id,
        userName: user.value?.userName ?? '',
        nickName: user.value?.nickName ?? '',
        telephone: '',
        email: '',
        sex: 0,
        language: 'zh',
      }
      applyProfile(fallback)
      showToast('error', e instanceof Error ? e.message : t('profile.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  function validateBasic() {
    if (!form.value.nickName?.trim()) return t('system.user.nickNameRequired')
    const phone = form.value.telephone?.trim()
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) return t('system.user.phoneInvalid')
    const email = form.value.email?.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('system.user.emailInvalid')
    return null
  }

  async function saveBasic() {
    const error = validateBasic()
    if (error) {
      showToast('error', error)
      return false
    }
    if (!form.value.id) {
      showToast('error', t('profile.loadFailed'))
      return false
    }

    saving.value = true
    try {
      const payload: SysUserVo = {
        id: form.value.id,
        userName: form.value.userName,
        nickName: form.value.nickName!.trim(),
        telephone: form.value.telephone?.trim() || undefined,
        email: form.value.email?.trim() || undefined,
        sex: Number(form.value.sex ?? 0),
        status: form.value.status ?? 1,
      }

      const result = await updateUserProfileApi(payload)
      if (result.code !== API_SUCCESS_CODE) {
        throw new Error(result.msg || t('profile.saveFailed'))
      }

      const nextLanguage = form.value.language as AppLocale | undefined
      if (nextLanguage && ['zh', 'en', 'ja'].includes(nextLanguage) && nextLanguage !== profile.value?.language) {
        const langResult = await updateUserLanguageApi(nextLanguage)
        if (langResult.code === API_SUCCESS_CODE) {
          setLocale(nextLanguage)
        }
      }

      updateStoredUser({
        nickName: payload.nickName,
        userName: payload.userName,
      })
      profile.value = { ...profile.value, ...payload, language: nextLanguage }
      showToast('success', t('profile.saveOk'))
      return true
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('profile.saveFailed'))
      return false
    } finally {
      saving.value = false
    }
  }

  function validatePassword() {
    const pwd = passwordForm.value.newPassword.trim()
    const confirm = passwordForm.value.confirmPassword.trim()
    if (!pwd) return t('profile.passwordRequired')
    if (pwd.length < 5 || pwd.length > 20) return t('system.user.passwordLength')
    if (pwd !== confirm) return t('profile.passwordMismatch')
    return null
  }

  async function changePassword() {
    const error = validatePassword()
    if (error) {
      showToast('error', error)
      return false
    }
    if (!profile.value?.id) {
      showToast('error', t('profile.loadFailed'))
      return false
    }

    saving.value = true
    try {
      const result = await resetUserPasswordApi(profile.value.id, passwordForm.value.newPassword.trim())
      if (result.code !== API_SUCCESS_CODE) {
        throw new Error(result.msg || t('profile.passwordFailed'))
      }
      passwordForm.value = createPasswordForm()
      showToast('success', t('profile.passwordOk'))
      return true
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('profile.passwordFailed'))
      return false
    } finally {
      saving.value = false
    }
  }

  function resetPasswordForm() {
    passwordForm.value = createPasswordForm()
  }

  return {
    loading,
    saving,
    activeTab,
    profile,
    form,
    passwordForm,
    load,
    saveBasic,
    changePassword,
    resetPasswordForm,
  }
}
