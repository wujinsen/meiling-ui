<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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
            <label
              v-for="opt in channelOptions"
              :key="opt.key"
              class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm transition hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-500/40"
            >
              <input
                :checked="channels[opt.key]"
                type="checkbox"
                class="rounded text-brand-600"
                @change="setChannel(opt.key, ($event.target as HTMLInputElement).checked)"
              />
              {{ t(opt.labelKey) }}
            </label>
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
