<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePersona } from '@/composables/usePersona'
import type { ChurnRisk, PersonaRange } from '@/types/persona'
import { riskClass } from '@/composables/personaMock'
import BiKpiCard from '@/components/bi/BiKpiCard.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import PersonaTrendChart from '@/views/CandlelightDragon/userportrait/components/PersonaTrendChart.vue'
import PersonaDetailDrawer from '@/views/CandlelightDragon/userportrait/components/PersonaDetailDrawer.vue'
import { RefreshCw, Search, Sparkles, ChevronRight } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()

const {
  loading,
  overview,
  filters,
  detailOpen,
  detailLoading,
  detail,
  load,
  openUser,
  closeDetail,
  setSegment,
} = usePersona()

const ranges: PersonaRange[] = ['7d', '30d', '90d']
const risks: { value: ChurnRisk | ''; labelKey: string }[] = [
  { value: '', labelKey: 'persona.risk.all' },
  { value: 'low', labelKey: 'persona.risk.low' },
  { value: 'medium', labelKey: 'persona.risk.medium' },
  { value: 'high', labelKey: 'persona.risk.high' },
]

const lifecycleData = computed(() =>
  overview.value?.lifecycle.map((i) => ({ name: t(i.nameKey), value: i.value })) ?? [],
)

const platformData = computed(() =>
  overview.value?.platforms.map((i) => ({ name: t(i.nameKey), value: i.value })) ?? [],
)

const platformColors = ['#8b5cf6', '#3b82f6', '#10b981']
</script>

<template>
  <div class="page-stack">
    <div class="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h1 class="page-title text-xl">{{ t('persona.title') }}</h1>
        <p class="page-subtitle mt-1">{{ t('persona.subtitle') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-ghost" @click="router.push('/insight/pulse')">
          <Sparkles class="h-4 w-4" />
          {{ t('persona.goPulse') }}
        </button>
        <button type="button" class="btn-ghost" :disabled="loading" @click="load">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          {{ t('persona.refresh') }}
        </button>
      </div>
    </div>

    <div class="card flex flex-wrap items-center gap-3 p-4">
      <select
        :value="filters.range"
        class="field-input"
        @change="filters.range = ($event.target as HTMLSelectElement).value as PersonaRange"
      >
        <option v-for="r in ranges" :key="r" :value="r">{{ t(`persona.range.${r}`) }}</option>
      </select>
      <select
        :value="filters.risk"
        class="field-input"
        @change="filters.risk = ($event.target as HTMLSelectElement).value as ChurnRisk | ''"
      >
        <option v-for="r in risks" :key="r.value || 'all'" :value="r.value">{{ t(r.labelKey) }}</option>
      </select>
      <div class="relative min-w-[200px] flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="filters.search"
          type="search"
          class="field-input w-full pl-9"
          :placeholder="t('persona.searchPlaceholder')"
        />
      </div>
      <span v-if="overview" class="text-xs text-gray-400">
        {{ t('persona.refreshedAt', { time: new Date(overview.refreshedAt).toLocaleTimeString() }) }}
      </span>
    </div>

    <section v-if="overview" class="kpi-grid">
      <BiKpiCard
        v-for="kpi in overview.kpis"
        :key="kpi.key"
        :label-key="kpi.labelKey"
        :value="kpi.value"
        :sub-key="kpi.subKey"
        :change="kpi.change"
        :up="kpi.up"
      />
    </section>

    <section v-if="overview" class="chart-row">
      <div class="chart-row-main">
        <div class="card card-interactive p-5">
          <h2 class="page-title">{{ t('persona.chart.trendTitle') }}</h2>
          <p class="page-subtitle mb-4">{{ t('persona.chart.trendSub') }}</p>
          <PersonaTrendChart :data="overview.trend" />
        </div>
      </div>
      <div class="chart-row-side space-y-4">
        <div class="card card-interactive p-5">
          <h2 class="page-title">{{ t('persona.chart.lifecycleTitle') }}</h2>
          <p class="page-subtitle mb-3">{{ t('persona.chart.lifecycleSub') }}</p>
          <DonutChart :data="lifecycleData" centered />
        </div>
        <div class="card card-interactive p-5">
          <h2 class="page-title">{{ t('persona.chart.platformTitle') }}</h2>
          <p class="page-subtitle mb-3">{{ t('persona.chart.platformSub') }}</p>
          <DonutChart :data="platformData" centered />
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="(item, i) in platformData"
              :key="item.name"
              class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-white/10"
            >
              <span class="h-2 w-2 rounded-full" :style="{ background: platformColors[i] }" />
              {{ item.name }} {{ item.value }}%
            </span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="overview" class="card p-5">
      <h2 class="page-title mb-1">{{ t('persona.segments.title') }}</h2>
      <p class="page-subtitle mb-4">{{ t('persona.segments.sub') }}</p>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          v-for="seg in overview.segments"
          :key="seg.id"
          type="button"
          :class="[
            'list-item p-4 text-left transition hover:shadow-sm',
            filters.segmentId === seg.id && 'ring-2 ring-brand-400 dark:ring-brand-500',
          ]"
          @click="setSegment(seg.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ background: seg.color }" />
            <span class="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{{ seg.count.toLocaleString() }}</span>
          </div>
          <p class="mt-2 font-medium text-gray-900 dark:text-white">{{ t(seg.nameKey) }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t(seg.descKey) }}</p>
        </button>
      </div>
    </section>

    <section v-if="overview" class="card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="page-title">{{ t('persona.users.title') }}</h2>
          <p class="page-subtitle">{{ t('persona.users.sub', { count: overview.users.length }) }}</p>
        </div>
        <button
          v-if="filters.segmentId"
          type="button"
          class="text-sm text-brand-600 dark:text-brand-400"
          @click="setSegment(filters.segmentId)"
        >
          {{ t('persona.segments.clear') }}
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/5">
              <th class="pb-3 pr-4">{{ t('persona.users.user') }}</th>
              <th class="pb-3 pr-4">{{ t('persona.users.platform') }}</th>
              <th class="pb-3 pr-4">{{ t('persona.users.score') }}</th>
              <th class="pb-3 pr-4">{{ t('persona.users.risk') }}</th>
              <th class="pb-3 pr-4">{{ t('persona.users.ltv') }}</th>
              <th class="pb-3 pr-4">{{ t('persona.users.tags') }}</th>
              <th class="pb-3 pr-4">{{ t('persona.users.lastActive') }}</th>
              <th class="pb-3 w-10" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in overview.users"
              :key="row.id"
              class="cursor-pointer border-b border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
              @click="openUser(row.id)"
            >
              <td class="py-3 pr-4">
                <div class="flex items-center gap-2.5">
                  <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
                    {{ row.avatar }}
                  </span>
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ row.nickname }}</p>
                    <p class="text-xs text-gray-500">{{ row.id }}</p>
                  </div>
                </div>
              </td>
              <td class="py-3 pr-4 text-gray-600 dark:text-gray-300">{{ t(`persona.platform.${row.platform}`) }}</td>
              <td class="py-3 pr-4 font-semibold tabular-nums text-brand-600 dark:text-brand-400">{{ row.engagementScore }}</td>
              <td class="py-3 pr-4">
                <span class="badge" :class="riskClass(row.churnRisk)">{{ t(`persona.risk.${row.churnRisk}`) }}</span>
              </td>
              <td class="py-3 pr-4 text-gray-600 dark:text-gray-300">{{ t(row.ltvTierKey) }}</td>
              <td class="py-3 pr-4">
                <div class="flex max-w-[200px] flex-wrap gap-1">
                  <span
                    v-for="tag in row.tagKeys.slice(0, 2)"
                    :key="tag"
                    class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300"
                  >
                    {{ t(tag) }}
                  </span>
                </div>
              </td>
              <td class="py-3 pr-4 text-gray-500">{{ row.lastActive }}</td>
              <td class="py-3">
                <ChevronRight class="h-4 w-4 text-gray-400" />
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!overview.users.length" class="py-10 text-center text-sm text-gray-500">{{ t('persona.users.empty') }}</p>
      </div>
    </section>

    <div v-if="loading && !overview" class="flex min-h-[40vh] items-center justify-center text-gray-500">
      {{ t('persona.loading') }}
    </div>

    <PersonaDetailDrawer
      :open="detailOpen"
      :user="detail"
      :loading="detailLoading"
      @close="closeDetail"
    />
  </div>
</template>
