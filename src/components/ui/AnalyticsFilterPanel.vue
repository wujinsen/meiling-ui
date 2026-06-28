<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import { useAnalyticsFilters } from '@/composables/useAnalyticsFilters'
import type { BiChannelKey } from '@/types/bi'

const { t } = useI18n()
const { isOpen, channels, close, apply, resetChannels, setChannel } = useAnalyticsFilters()

const channelOptions: { key: BiChannelKey; labelKey: string }[] = [
  { key: 'referrals', labelKey: 'chart.leadSources.referrals' },
  { key: 'organic', labelKey: 'chart.leadSources.organic' },
  { key: 'social', labelKey: 'chart.leadSources.social' },
  { key: 'paidAds', labelKey: 'chart.leadSources.paidAds' },
  { key: 'direct', labelKey: 'chart.leadSources.direct' },
]
</script>

<template>
  <Transition name="filter-panel">
    <div
      v-if="isOpen"
      class="border-b border-gray-100 bg-gray-50/90 px-6 py-4 backdrop-blur dark:border-white/5 dark:bg-surface-dark-elevated/90"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">{{ t('filters.channels') }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <AppCheckbox
              v-for="opt in channelOptions"
              :key="opt.key"
              variant="option"
              size="sm"
              :model-value="channels[opt.key]"
              @update:model-value="(v) => setChannel(opt.key, v)"
            >
              {{ t(opt.labelKey) }}
            </AppCheckbox>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn-ghost text-xs" @click="resetChannels">{{ t('bi.resetFilters') }}</button>
          <button type="button" class="btn-ghost text-xs" @click="close">{{ t('common.dismiss') }}</button>
          <button type="button" class="btn-primary text-xs" @click="apply">{{ t('filters.apply') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>
