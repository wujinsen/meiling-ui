<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, LogOut, UserRound } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'

const router = useRouter()
const { t } = useI18n()
const { displayName, user, logout } = useAuth()
const open = ref(false)
const signingOut = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const userInitial = computed(() => (displayName.value || 'U').charAt(0).toUpperCase())

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) close()
}

function handleOpenProfile() {
  close()
  router.push('/profile')
}

async function handleSignOut() {
  close()
  const ok = await confirm({
    message: t('auth.signOutMessage'),
    confirmText: t('auth.signOutConfirm'),
    cancelText: t('auth.signOutStay'),
    warm: true,
  })
  if (!ok) return

  signingOut.value = true
  try {
    await logout()
    showToast('success', t('auth.signOutSuccess'))
    await router.replace({ name: 'login' })
  } catch {
    showToast('error', t('auth.signOutFailed'))
  } finally {
    signingOut.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg border border-transparent py-1 pl-1 pr-2 transition hover:border-gray-200 hover:bg-gray-100 dark:hover:border-white/10 dark:hover:bg-white/5"
      :aria-expanded="open"
      :disabled="signingOut"
      @click.stop="toggle"
    >
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white"
      >
        {{ userInitial }}
      </div>
      <div class="hidden min-w-0 text-left sm:block">
        <p class="max-w-[8rem] truncate text-sm font-medium text-gray-900 dark:text-white">
          {{ displayName || t('user.name') }}
        </p>
        <p class="max-w-[8rem] truncate text-xs text-gray-500 dark:text-gray-400">
          {{ user?.userName || t('user.role') }}
        </p>
      </div>
      <ChevronDown
        class="hidden h-4 w-4 shrink-0 text-gray-400 transition sm:block"
        :class="open && 'rotate-180'"
      />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-surface-dark-elevated"
      @click.stop
    >
      <div class="border-b border-gray-100 px-4 py-3 dark:border-white/5">
        <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
          {{ displayName || t('user.name') }}
        </p>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">
          {{ user?.userName || t('user.role') }}
        </p>
      </div>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
        @click="handleOpenProfile"
      >
        <UserRound class="h-4 w-4" />
        {{ t('profile.title') }}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
        :disabled="signingOut"
        @click="handleSignOut"
      >
        <LogOut class="h-4 w-4" />
        {{ signingOut ? t('auth.signingOut') : t('auth.signOut') }}
      </button>
    </div>
  </div>
</template>
