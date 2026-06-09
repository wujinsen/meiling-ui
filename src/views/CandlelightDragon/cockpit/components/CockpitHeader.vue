<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CockpitGranularity, CockpitQuery, CockpitRange, CockpitTab } from '@/types/cockpit'
import { ENVIRONMENT_OPTIONS, environmentI18nKey } from '@/utils/operationEnv'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  filters: CockpitQuery
  loading: boolean
  refreshedAt?: string
  autoRefresh: boolean
  isFullscreen: boolean
}>()

const emit = defineEmits<{
  refresh: []
  'update:autoRefresh': [boolean]
  'update:tab': [CockpitTab]
  'update:range': [CockpitRange]
  'update:granularity': [CockpitGranularity]
  'update:environment': [number | '']
  toggleFullscreen: []
}>()

const { t } = useI18n()

const refreshedLabel = computed(() => {
  if (!props.refreshedAt) return ''
  const d = new Date(props.refreshedAt)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString()
})

const ranges: CockpitRange[] = ['7d', '30d', 'month', 'quarter']
const granularities: CockpitGranularity[] = ['day', 'week', 'month']
</script>

<template>
  <header class="card p-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="page-title text-xl lg:text-2xl">{{ t('cockpit.title') }}</h1>
        <p class="page-subtitle mt-1">{{ t('cockpit.subtitle') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="refreshedLabel" class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('cockpit.refreshedAt', { time: refreshedLabel }) }}
        </span>
        <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          <input
            type="checkbox"
            :checked="autoRefresh"
            class="rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-white/20 dark:bg-white/5"
            @change="emit('update:autoRefresh', ($event.target as HTMLInputElement).checked)"
          />
          {{ t('cockpit.autoRefresh') }}
        </label>
        <button type="button" class="btn-ghost" :disabled="loading" @click="emit('refresh')">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          {{ t('cockpit.refresh') }}
        </button>
        <button type="button" class="btn-ghost" @click="emit('toggleFullscreen')">
          <Maximize2 v-if="!isFullscreen" class="h-4 w-4" />
          <Minimize2 v-else class="h-4 w-4" />
          {{ isFullscreen ? t('cockpit.exitFullscreen') : t('cockpit.fullscreen') }}
        </button>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <div class="inline-flex rounded-lg bg-gray-100 p-1 text-sm dark:bg-white/5">
        <button
          type="button"
          :class="[
            'rounded-md px-4 py-1.5 font-medium transition',
            filters.tab === 'business'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          ]"
          @click="emit('update:tab', 'business')"
        >
          {{ t('cockpit.tab.business') }}
        </button>
        <button
          type="button"
          :class="[
            'rounded-md px-4 py-1.5 font-medium transition',
            filters.tab === 'ops'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          ]"
          @click="emit('update:tab', 'ops')"
        >
          {{ t('cockpit.tab.ops') }}
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <select
          :value="filters.range"
          class="field-input"
          @change="emit('update:range', ($event.target as HTMLSelectElement).value as CockpitRange)"
        >
          <option v-for="r in ranges" :key="r" :value="r">{{ t(`cockpit.range.${r}`) }}</option>
        </select>
        <select
          :value="filters.granularity"
          class="field-input"
          @change="emit('update:granularity', ($event.target as HTMLSelectElement).value as CockpitGranularity)"
        >
          <option v-for="g in granularities" :key="g" :value="g">{{ t(`cockpit.granularity.${g}`) }}</option>
        </select>
        <select
          v-if="filters.tab === 'ops'"
          :value="filters.environment"
          class="field-input"
          @change="emit('update:environment', ($event.target as HTMLSelectElement).value === '' ? '' : Number(($event.target as HTMLSelectElement).value))"
        >
          <option value="">{{ t('cockpit.envAll') }}</option>
          <option v-for="env in ENVIRONMENT_OPTIONS" :key="env" :value="env">{{ t(environmentI18nKey(env)) }}</option>
        </select>
      </div>
    </div>
  </header>
</template>
