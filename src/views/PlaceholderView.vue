<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Construction } from 'lucide-vue-next'

const route = useRoute()
const { t } = useI18n()

const title = computed(() => (route.meta.title as string) || t('placeholder.title'))
</script>

<template>
  <div class="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
      <Construction class="h-7 w-7" />
    </div>
    <h2 class="page-title text-xl">{{ title }}</h2>
    <p class="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('placeholder.desc') }}</p>
    <p class="mt-4 font-mono text-xs text-gray-400">{{ route.path }}</p>
  </div>
</template>
