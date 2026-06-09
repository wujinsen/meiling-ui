<script setup lang="ts">
import { Languages } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { setLocale, useLocale, type AppLocale } from '@/i18n'

const { locale } = useI18n()
const { options } = useLocale()

function onChange(e: Event) {
  setLocale((e.target as HTMLSelectElement).value as AppLocale)
}
</script>

<template>
  <div class="relative">
    <Languages class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    <select
      :value="locale"
      class="h-9 appearance-none rounded-lg border border-gray-200 bg-white py-0 pl-8 pr-7 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-surface-dark-elevated dark:text-gray-200 dark:hover:bg-white/5 dark:focus:border-brand-500 dark:focus:ring-brand-500/20"
      @change="onChange"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>
