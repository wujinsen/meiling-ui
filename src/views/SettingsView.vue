<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Bell, ChevronRight, Monitor, Palette, Shield, Sparkles } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { usePerspective } from '@/composables/usePerspective'
import { useAppSettings, type FontSizePreset } from '@/composables/useAppSettings'
import { useLocale } from '@/i18n'
import { showToast } from '@/composables/useToast'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'

const router = useRouter()
const { t, locale } = useI18n()
const { isDark, setTheme } = useTheme()
const { isPerspective, togglePerspective } = usePerspective()
const { settings } = useAppSettings()
const { options: localeOptions, setLocale } = useLocale()

const fontSizeOptions = computed(() => [
  { value: 'sm', label: t('settings.appearance.fontSizeSm') },
  { value: 'md', label: t('settings.appearance.fontSizeMd') },
  { value: 'lg', label: t('settings.appearance.fontSizeLg') },
  { value: 'xl', label: t('settings.appearance.fontSizeXl') },
])

function onThemeChange(e: Event) {
  setTheme((e.target as HTMLSelectElement).value === 'dark')
}

function onLocaleChange(e: Event) {
  setLocale((e.target as HTMLSelectElement).value as 'zh' | 'en' | 'ja')
  showToast('success', t('settings.saveOk'))
}

function onFontSizeChange(value: number | string) {
  settings.value.fontSize = value as FontSizePreset
  showToast('success', t('settings.saveOk'))
}

function goProfile() {
  router.push('/profile')
}

type NotificationKey = 'emailNotifications' | 'browserNotifications' | 'weeklyDigest' | 'dealAlerts'

const notificationItems: { key: NotificationKey; label: string; sub: string }[] = [
  { key: 'emailNotifications', label: 'settings.notifications.email', sub: 'settings.notifications.emailSub' },
  { key: 'browserNotifications', label: 'settings.notifications.browser', sub: 'settings.notifications.browserSub' },
  { key: 'weeklyDigest', label: 'settings.notifications.weekly', sub: 'settings.notifications.weeklySub' },
  { key: 'dealAlerts', label: 'settings.notifications.deals', sub: 'settings.notifications.dealsSub' },
]

function toggleNotification(key: NotificationKey) {
  settings.value[key] = !settings.value[key]
}

function setNotification(key: NotificationKey, value: boolean) {
  settings.value[key] = value
}
</script>

<template>
  <div class="page-stack">
    <div class="card p-4">
      <h1 class="page-title text-xl">{{ t('settings.title') }}</h1>
      <p class="page-subtitle mt-1">{{ t('settings.subtitle') }}</p>
    </div>

    <section class="card p-5">
      <div class="mb-4 flex items-center gap-2">
        <Palette class="h-5 w-5 text-brand-500" />
        <h2 class="page-title text-base">{{ t('settings.appearance.title') }}</h2>
      </div>
      <p class="page-subtitle mb-4">{{ t('settings.appearance.sub') }}</p>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-sm text-gray-500 dark:text-gray-400">{{ t('settings.appearance.theme') }}</span>
          <select class="field-input" :value="isDark ? 'dark' : 'light'" @change="onThemeChange">
            <option value="light">{{ t('settings.appearance.light') }}</option>
            <option value="dark">{{ t('settings.appearance.dark') }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm text-gray-500 dark:text-gray-400">{{ t('settings.appearance.language') }}</span>
          <select class="field-input" :value="locale" @change="onLocaleChange">
            <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="mt-4">
        <span class="mb-2 block text-sm text-gray-500 dark:text-gray-400">{{ t('settings.appearance.fontSize') }}</span>
        <SegmentControl
          :model-value="settings.fontSize"
          :options="fontSizeOptions"
          @update:model-value="onFontSizeChange"
        />
        <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.appearance.fontSizeSub') }}</p>
      </div>

      <div class="mt-4 flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-white/5" @click="togglePerspective()">
        <div class="flex items-center gap-3">
          <Monitor class="h-4 w-4 text-gray-400" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.appearance.perspective') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.appearance.perspectiveSub') }}</p>
          </div>
        </div>
        <AppCheckbox
          standalone
          :model-value="isPerspective"
          @update:model-value="togglePerspective()"
          @click.stop
        />
      </div>
    </section>

    <section class="card p-5">
      <div class="mb-4 flex items-center gap-2">
        <Bell class="h-5 w-5 text-brand-500" />
        <h2 class="page-title text-base">{{ t('settings.notifications.title') }}</h2>
      </div>
      <p class="page-subtitle mb-4">{{ t('settings.notifications.sub') }}</p>

      <div class="space-y-3">
        <div
          v-for="item in notificationItems"
          :key="item.key"
          class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-white/5"
          @click="toggleNotification(item.key)"
        >
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t(item.label) }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t(item.sub) }}</p>
          </div>
          <AppCheckbox
            standalone
            :model-value="settings[item.key]"
            @update:model-value="(v) => setNotification(item.key, v)"
            @click.stop
          />
        </div>
      </div>
    </section>

    <section class="card divide-y divide-gray-100 dark:divide-white/5">
      <button
        type="button"
        class="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
        @click="goProfile"
      >
        <div class="flex items-center gap-3">
          <Shield class="h-5 w-5 text-brand-500" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.security.title') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.security.sub') }}</p>
          </div>
        </div>
        <ChevronRight class="h-4 w-4 text-gray-400" />
      </button>

      <div class="flex items-center justify-between px-5 py-4">
        <div class="flex items-center gap-3">
          <Sparkles class="h-5 w-5 text-brand-500" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.about.title') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.about.sub') }}</p>
          </div>
        </div>
        <span class="text-xs text-gray-400">v0.1.0</span>
      </div>
    </section>
  </div>
</template>
