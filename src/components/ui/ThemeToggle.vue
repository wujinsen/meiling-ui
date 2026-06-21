<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

defineProps<{
  /** 叠在图片/深色背景上时使用，提高按钮与图标对比度 */
  onMedia?: boolean
}>()

const { isDark, toggleTheme } = useTheme()
const { t } = useI18n()
const title = computed(() => (isDark.value ? t('theme.toLight') : t('theme.toDark')))
</script>

<template>
  <button
    type="button"
    class="flex h-9 w-9 items-center justify-center rounded-lg border transition"
    :class="
      onMedia
        ? 'border-white/80 bg-white/[0.92] text-gray-700 shadow-sm backdrop-blur-sm hover:border-white hover:bg-white hover:text-brand-700 dark:border-white/15 dark:bg-gray-950/[0.88] dark:text-gray-100 dark:hover:border-white/25 dark:hover:bg-gray-900'
        : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'
    "
    :title="title"
    @click="toggleTheme($event)"
  >
    <Sun v-if="isDark" key="sun" class="theme-icon h-4 w-4" />
    <Moon v-else key="moon" class="theme-icon h-4 w-4" />
  </button>
</template>
