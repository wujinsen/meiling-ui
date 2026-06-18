<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MeilingLogo from '@/components/ui/MeilingLogo.vue'

withDefaults(
  defineProps<{
    variant?: 'sidebar' | 'hero'
  }>(),
  { variant: 'sidebar' },
)

const { t } = useI18n()
</script>

<template>
  <div
    :class="[
      'flex items-center',
      variant === 'hero' ? 'flex-col items-center gap-3 text-center' : 'min-w-0 gap-3',
    ]"
  >
    <MeilingLogo v-if="variant === 'hero'" variant="full" />
    <div
      v-else
      class="brand-mark-icon flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f7f3ea] ring-1 ring-emerald-900/10 dark:bg-[#1a2420] dark:ring-emerald-100/10"
      :title="t('app.title')"
      :aria-label="t('app.title')"
    >
      <MeilingLogo :size="40" variant="icon" />
    </div>
    <span v-if="variant !== 'hero'" class="brand-wordmark-sidebar min-w-0 truncate">
      {{ t('app.name') }}
    </span>
  </div>
</template>
