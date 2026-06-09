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
      variant === 'hero' ? 'flex-col items-center gap-4 text-center' : 'min-w-0 gap-2.5',
    ]"
  >
    <div
      :class="[
        'flex shrink-0 items-center justify-center bg-gradient-to-br from-[#F0D4D0] via-[#E0B888] to-[#C49A6C]',
        variant === 'hero'
          ? 'h-14 w-14 rounded-2xl shadow-[0_0_20px_rgba(196,154,108,0.35)]'
          : 'h-8 w-8 rounded-[9px] shadow-[0_0_12px_rgba(196,154,108,0.32)]',
      ]"
      :title="t('app.title')"
      :aria-label="t('app.title')"
    >
      <MeilingLogo :size="variant === 'hero' ? 32 : 20" />
    </div>
    <span
      :class="[
        'brand-wordmark truncate',
        variant === 'hero' ? 'brand-wordmark-hero' : 'brand-wordmark-sidebar',
      ]"
    >
      {{ t('app.name') }}
    </span>
  </div>
</template>
