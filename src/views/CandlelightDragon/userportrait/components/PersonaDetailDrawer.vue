<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import AnimatedProgress from '@/components/ui/AnimatedProgress.vue'
import type { PersonaUserDetail } from '@/types/persona'
import { riskClass } from '@/composables/personaMock'
import { Smartphone, Monitor, Globe } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  user: PersonaUserDetail | null
  loading: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const platformIcon = computed(() => {
  const p = props.user?.platform
  if (p === 'ios' || p === 'android') return Smartphone
  return props.user?.platform === 'web' ? Globe : Monitor
})
</script>

<template>
  <AppModal :open="open" :title="user ? user.nickname : t('persona.detail.title')" wide @close="emit('close')">
    <div v-if="loading" class="py-16 text-center text-gray-500 dark:text-gray-400">{{ t('persona.loading') }}</div>
    <div v-else-if="user" class="space-y-5">
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-bold text-white">
          {{ user.avatar }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ user.nickname }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.id }} · {{ user.email }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span class="badge" :class="riskClass(user.churnRisk)">{{ t(`persona.risk.${user.churnRisk}`) }}</span>
            <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ t(user.ltvTierKey) }}</span>
            <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ t(`persona.platform.${user.platform}`) }}</span>
          </div>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold tabular-nums text-brand-600 dark:text-brand-400">{{ user.engagementScore }}</p>
          <p class="text-xs text-gray-500">{{ t('persona.detail.engagementScore') }}</p>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
          <p class="text-xs text-gray-500">{{ t('persona.detail.sessions') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ user.sessions }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
          <p class="text-xs text-gray-500">{{ t('persona.detail.avgSession') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ user.avgSessionMin }}m</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
          <p class="text-xs text-gray-500">{{ t('persona.detail.lastActive') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ user.lastActive }}</p>
        </div>
      </div>

      <div>
        <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('persona.detail.engagementScore') }}</p>
        <AnimatedProgress
          :percent="user.engagementScore"
          track-class="h-2.5"
          bar-class="bg-gradient-to-r from-brand-500 to-brand-600"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <span
          v-for="tag in user.tagKeys"
          :key="tag"
          class="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
        >
          {{ t(tag) }}
        </span>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card p-4">
          <h3 class="page-title mb-3 text-sm">{{ t('persona.detail.device') }}</h3>
          <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <component :is="platformIcon" class="h-5 w-5 text-brand-500" />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ user.device }}</p>
              <p class="text-xs text-gray-500">{{ user.os }} · {{ t(user.regionKey) }}</p>
            </div>
          </div>
        </div>
        <div class="card p-4">
          <h3 class="page-title mb-3 text-sm">{{ t('persona.detail.topEvents') }}</h3>
          <div class="space-y-2">
            <div
              v-for="ev in user.topEvents"
              :key="ev.eventKey"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-gray-600 dark:text-gray-400">{{ t(ev.eventKey) }}</span>
              <span class="font-medium tabular-nums text-gray-900 dark:text-white">{{ ev.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="page-title mb-3 text-sm">{{ t('persona.detail.timeline') }}</h3>
        <div class="space-y-3">
          <div
            v-for="item in user.timeline"
            :key="item.id"
            class="flex gap-3 border-l-2 border-brand-200 pl-3 dark:border-brand-500/40"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t(item.typeKey) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t(item.descKey) }}</p>
            </div>
            <span class="shrink-0 text-xs text-gray-400">{{ item.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('persona.close') }}</button>
    </template>
  </AppModal>
</template>
