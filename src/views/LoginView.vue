<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BrandMark from '@/components/ui/BrandMark.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import { useAuth } from '@/composables/useAuth'
import { isMockAuthEnabled } from '@/api/auth'
import { Loader2 } from 'lucide-vue-next'

const loginBgUrl = `${import.meta.env.BASE_URL}images/login-bg.jpg?v=4k`

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { login } = useAuth()

const userName = ref('test')
const password = ref('123456')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  if (!userName.value.trim() || !password.value) {
    error.value = t('auth.required')
    return
  }

  loading.value = true
  try {
    const result = await login({
      userName: userName.value.trim(),
      password: password.value,
    })
    const nextPath =
      'nextPath' in result && typeof result.nextPath === 'string'
        ? result.nextPath
        : typeof route.query.redirect === 'string'
          ? route.query.redirect
          : '/'
    await router.replace(nextPath || '/')
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_SYSTEM_ASSIGNED') {
      error.value = t('system.portal.noSystem')
    } else {
      error.value = e instanceof Error ? e.message : t('auth.failed')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <img class="login-page-bg" :src="loginBgUrl" alt="" fetchpriority="high" />
    <div class="login-page-scrim" aria-hidden="true" />

    <div class="login-page-content flex min-h-screen flex-col">
      <header class="login-page-header flex items-center justify-end gap-2 px-6 py-4">
        <LanguageSwitcher />
        <ThemeToggle on-media />
      </header>

      <div class="flex flex-1 items-center justify-center px-4 pb-16">
        <div class="w-full max-w-md">
          <div class="mb-8">
            <BrandMark variant="hero" />
            <p class="login-page-subtitle mt-3 text-center text-sm">{{ t('auth.subtitle') }}</p>
          </div>

          <form class="login-card card p-6 shadow-card" @submit.prevent="onSubmit">
            <div class="space-y-4">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300" for="username">
                  {{ t('auth.username') }}
                </label>
                <input
                  id="username"
                  v-model="userName"
                  type="text"
                  autocomplete="username"
                  class="field-input"
                  :placeholder="t('auth.usernamePlaceholder')"
                />
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300" for="password">
                  {{ t('auth.password') }}
                </label>
                <input
                  id="password"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  class="field-input"
                  :placeholder="t('auth.passwordPlaceholder')"
                />
              </div>
            </div>

            <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {{ error }}
            </p>

            <button type="submit" class="btn-primary mt-6 w-full justify-center py-2.5" :disabled="loading">
              <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
              {{ loading ? t('auth.signingIn') : t('auth.signIn') }}
            </button>

            <p v-if="isMockAuthEnabled()" class="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              {{ t('auth.mockHint') }}
            </p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
