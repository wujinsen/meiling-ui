<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PortalSystemPicker from '@/components/portal/PortalSystemPicker.vue'
import BrandMark from '@/components/ui/BrandMark.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import { filterPortalSystems, groupPortalSystems, portalGroupDomId } from '@/constants/systemGroup'
import { useAuth } from '@/composables/useAuth'
import { confirm } from '@/composables/useConfirm'
import { usePortalGreeting } from '@/composables/usePortalGreeting'
import { useSystemPortal } from '@/composables/useSystemPortal'
import { showToast } from '@/composables/useToast'
import { hasFullPermission } from '@/utils/privilege'
import { Loader2, LogOut, Rocket, Search, ShieldCheck, Sparkles } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const { displayName, user, logout } = useAuth()
const { greeting } = usePortalGreeting()
const { systemList, enterSystem, refreshSystemList } = useSystemPortal()

const userInitial = computed(() => (displayName.value || user.value?.userName || 'U').charAt(0).toUpperCase())
const isSuperAdmin = computed(() => hasFullPermission(user.value?.userName))

const loadingId = ref<number | string | null>(null)
const booting = ref(false)
const signingOut = ref(false)
const keyword = ref('')
const activeGroup = ref('')

const groupedSystems = computed(() => groupPortalSystems(filterPortalSystems(systemList.value, keyword.value)))
const totalCount = computed(() => systemList.value.length)
const filteredCount = computed(() => filterPortalSystems(systemList.value, keyword.value).length)
const showSearch = computed(() => systemList.value.length > 4)

async function onSelect(systemId: number | string) {
  if (loadingId.value != null) return
  loadingId.value = systemId
  try {
    const target = await enterSystem(systemId)
    if (typeof target === 'string' && target.startsWith('http')) return
    await router.replace(target || '/profile')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.portal.enterFailed'))
  } finally {
    loadingId.value = null
  }
}

async function scrollToGroup(key: string) {
  activeGroup.value = key
  await nextTick()
  document.getElementById(portalGroupDomId(key as never))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleSignOut() {
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

onMounted(async () => {
  booting.value = true
  try {
    await refreshSystemList()
    if (!systemList.value.length) {
      showToast('error', t('system.portal.noSystem'))
    }
  } finally {
    booting.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface-light dark:bg-surface-dark">
    <header class="flex shrink-0 items-center justify-end border-b border-gray-100 px-4 py-3 dark:border-white/5 sm:px-6">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-sm text-gray-600 transition hover:bg-gray-100 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 sm:px-3"
          :title="t('auth.signOut')"
          :disabled="signingOut"
          @click="handleSignOut"
        >
          <LogOut class="h-4 w-4 shrink-0" />
          <span class="hidden sm:inline">{{ signingOut ? t('auth.signingOut') : t('auth.signOut') }}</span>
        </button>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>

    <div class="relative overflow-hidden border-b border-gray-100 px-4 py-6 dark:border-white/5 sm:px-6 sm:py-8">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100/80 via-transparent to-transparent dark:from-brand-500/10"
        aria-hidden="true"
      />
      <div class="relative mx-auto max-w-6xl">
        <div class="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3 sm:gap-4">
            <div
              class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-semibold text-white shadow-lg shadow-brand-500/25"
            >
              {{ userInitial }}
              <span
                v-if="isSuperAdmin"
                class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-white dark:ring-surface-dark"
              >
                <ShieldCheck class="h-3 w-3" />
              </span>
            </div>
            <div class="min-w-0 text-left">
              <p class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <Sparkles class="h-3.5 w-3.5 text-brand-500" />
                {{ greeting }}
              </p>
              <h2 class="truncate text-xl font-semibold sm:text-2xl">
                <span class="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent dark:from-brand-300 dark:to-violet-300">
                  {{ displayName || user?.userName }}
                </span>
              </h2>
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <span v-if="user?.userName" class="text-xs text-gray-400">@{{ user.userName }}</span>
                <span
                  v-if="isSuperAdmin"
                  class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                >
                  <ShieldCheck class="h-3 w-3" />
                  {{ t('system.portal.superAdminTag') }}
                </span>
              </div>
            </div>
          </div>
          <div class="portal-motivation-card sm:max-w-sm">
            <div class="portal-motivation-shimmer" aria-hidden="true" />
            <div class="portal-motivation-body">
              <span class="portal-motivation-icon-wrap" aria-hidden="true">
                <Rocket class="portal-motivation-icon h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="portal-motivation-title">{{ t('system.portal.welcomeBack') }}</p>
                <p class="portal-motivation-action">{{ t('system.portal.welcomeHint') }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="text-center">
          <BrandMark variant="hero" class="mx-auto scale-90" />
          <h1 class="mt-3 text-lg font-semibold text-gray-900 dark:text-white">{{ t('system.portal.title') }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('system.portal.subtitle') }}</p>
          <p v-if="!booting && totalCount" class="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
            {{ t('system.portal.systemTotal', { count: totalCount }) }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="booting" class="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-gray-500">
      <Loader2 class="h-4 w-4 animate-spin" />
      {{ t('system.portal.loading') }}
    </div>

    <template v-else-if="systemList.length">
      <div
        class="sticky top-0 z-10 border-b border-gray-100 bg-surface-light/95 px-4 py-3 backdrop-blur dark:border-white/5 dark:bg-surface-dark/95 sm:px-6"
      >
        <div class="mx-auto max-w-6xl space-y-2">
          <div v-if="showSearch" class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <Search class="h-4 w-4 shrink-0 text-gray-400" />
            <input
              v-model="keyword"
              type="search"
              class="field-input min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0"
              :placeholder="t('system.portal.searchPlaceholder')"
            />
          </div>
          <div v-if="groupedSystems.length > 1 && !keyword" class="-mx-1 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              v-for="group in groupedSystems"
              :key="group.key"
              type="button"
              class="shrink-0 rounded-full px-3 py-1 text-xs transition"
              :class="
                activeGroup === group.key
                  ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
              "
              @click="scrollToGroup(group.key)"
            >
              {{ t(`system.portal.group.${group.key}`) }}
              <span class="ml-1 tabular-nums opacity-70">{{ group.items.length }}</span>
            </button>
          </div>
          <p v-else-if="keyword" class="text-xs text-gray-400">
            {{ t('system.portal.searchResult', { count: filteredCount, total: totalCount }) }}
          </p>
        </div>
      </div>

      <main class="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div class="mx-auto max-w-6xl">
          <PortalSystemPicker
            v-model:search-query="keyword"
            :systems="systemList"
            variant="page"
            :loading-id="loadingId"
            :show-search="false"
            block-unavailable
            @select="onSelect"
          />
        </div>
      </main>
    </template>

    <p v-else class="py-16 text-center text-sm text-gray-500">{{ t('system.portal.noSystem') }}</p>
  </div>
</template>

<style scoped>
.portal-motivation-card {
  @apply relative overflow-hidden rounded-2xl p-[1px];
}

.portal-motivation-shimmer {
  @apply absolute inset-0 rounded-2xl opacity-90;
  background: linear-gradient(120deg, #a78bfa, #8b5cf6, #f59e0b, #7c3aed);
  background-size: 220% 100%;
  animation: portal-motivation-flow 5s ease-in-out infinite;
}

.portal-motivation-body {
  @apply relative flex items-start gap-3 rounded-[calc(1rem-1px)] bg-white/95 px-4 py-3.5 backdrop-blur-sm dark:bg-surface-dark-card/95;
}

.portal-motivation-icon-wrap {
  @apply mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-md shadow-brand-500/30;
  animation: portal-motivation-lift 2.8s ease-in-out infinite;
}

.portal-motivation-title {
  @apply text-sm font-semibold text-gray-800 dark:text-gray-100;
}

.portal-motivation-action {
  @apply mt-1 text-xs font-medium leading-snug text-brand-600 dark:text-brand-300;
}

@keyframes portal-motivation-flow {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes portal-motivation-lift {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}
</style>
