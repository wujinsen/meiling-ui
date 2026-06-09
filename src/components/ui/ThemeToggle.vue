<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
const { t } = useI18n()
const title = computed(() => (isDark.value ? t('theme.toLight') : t('theme.toDark')))
</script>

<template>
  <button
    type="button"
    class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
    :title="title"
    @click="toggleTheme($event)"
  >
    <Sun v-if="isDark" key="sun" class="theme-icon h-4 w-4" />
    <Moon v-else key="moon" class="theme-icon h-4 w-4" />
  </button>
</template>
